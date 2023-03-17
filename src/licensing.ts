import { camelToUnderscore, findUserByCustomerId, getRandomString, setUserCustomerIdById, updateUserById } from './auth';
import { dbQuery } from './db';
import { User, License, PublicLicense } from './models/auth';
import * as encryption from './crypto';

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_API_KEY, {
  apiVersion: '2020-08-27',
});
const STRIPE_API_BASE_URL = 'https://api.stripe.com';


const licenseFromDbResult = (result: any) => {
  return <License> {
    id: result['id'],
    userId: result['user_id'],
    licenseId: result['license_id'],
    stripeSubscriptionId: result['stripe_subscription_id'],
    stripeSubscriptionPlanId: result['stripe_subscription_plan_id'],
    stripeSubscriptionStatus: result['stripe_subscription_status'],
    stripeSubscriptionCancelAtPeriodEnd: !(!result['stripe_subscription_cancel_at_period_end']),
    stripeSubscriptionCurrentPeriodEnd: result['stripe_subscription_current_period_end'],
    active: !(!result['active']),
    createdAt: result['created_at'],
    updatedAt: result['updated_at']
  };
}

const toPublicLicense = (license: License): PublicLicense => {
  return <PublicLicense> {
    id: encryption.encrypt(license.id.toString()),
    licenseId: license.licenseId,
    active: license.active,
    createdAt: license.createdAt,
    updatedAt: license.updatedAt
  };
}



const findLicenseById = async (id: number) => {
  const results = await dbQuery('SELECT * FROM user_licenses WHERE id = ?', [id]);
  return (results.length) ? licenseFromDbResult(results[0]) : null;
}

const findLicenseByUserId = async (userId: number) => {
  const results = await dbQuery('SELECT * FROM user_licenses WHERE user_id = ?', [userId]);
  return (results.length) ? licenseFromDbResult(results[0]) : null;
}

const createLicense = async (
  userId: number, 
  licenseId: number, 
  subscriptionId: string,
  subscriptionPlanId: string,
  subscriptionStatus: string, 
  subscriptionCancelAtPeriodEnd: boolean,
  subscriptionCurrentPeriodEnd: Date) => {
  const results = await dbQuery(`INSERT INTO user_licenses(user_id,license_id,stripe_subscription_id,stripe_subscription_plan_id,stripe_subscription_status,stripe_subscription_cancel_at_period_end,stripe_subscription_current_period_end)
                                  VALUES(?,?,?,?,?,?,?)`, [userId, licenseId, subscriptionId, subscriptionPlanId, subscriptionStatus, subscriptionCancelAtPeriodEnd, subscriptionCurrentPeriodEnd]);
  
  return (await findLicenseById(results['insertId']));
}



interface LicenseUpdate {
  licenseId?: number;
  stripeSubscriptionId?: string;
  stripeSubscriptionPlanId?: string;
  stripeSubscriptionStatus?: string;
  stripeSubscriptionCancelAtPeriodEnd?: boolean;
  stripeSubscriptionCurrentPeriodEnd?: Date;
}

async function updateLicenseById(
  id: number,
  userLicenseUpdate: LicenseUpdate
): Promise<License> {
  const query = `UPDATE user_licenses SET ${
                Object.entries(userLicenseUpdate).filter(([key]) => key !== 'userId' && userLicenseUpdate[key] !== undefined).map(([key]) => `${camelToUnderscore(key)} = ?`).join(',')
              } WHERE id = ?;`;

  const params = Object.values(userLicenseUpdate).filter((value) => value !== undefined);
  params.push(id);

  const results = await dbQuery(query, params);
  return (await findLicenseById(id));
}


const getStripeCustomers = async () => {
  const customers = await stripe.customers.list({ limit: 3 },   {
    apiKey: process.env.STRIPE_API_KEY
  });
  console.log('customers: ', customers);
}

async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  const customers = await stripe.customers.list({
    email,
    limit: 1
  });

  let customer = customers.data.find(e => e.metadata.userId === userId);

  if (customer) {
    // return the ID of the existing customer
    return customer.id;
  }

  // create a new customer with the specified email and metadata
  customer = await stripe.customers.create({
    email,
    metadata: {
      userId,
    },
  });
  await setUserCustomerIdById(parseInt(userId), customer.id);

  // return the ID of the newly created customer
  return customer.id; 
}

async function getProductFromPlanId(planId: string): Promise<Stripe.Product | null> {
  try {
    const plan = await stripe.plans.retrieve(planId);
    const productId = plan.product as string;
    const product = await stripe.products.retrieve(productId);
    return product;
  } catch (err) {
    console.error(`Error retrieving product for plan ${planId}: ${err}`);
    return null;
  }
}

const createFreeLicense = async (user: User): Promise<License> => {
  const license = await createLicense(
    user.id,
    0,
    null,
    null,
    null,
    null,
    null
  );
  
  console.debug(`Created user license: `, license);
  return license;
}

interface ExtendedSubscription extends Stripe.Subscription {
  plan: Stripe.Plan;
}


const stripeWebhookHandler = async (event) => {
  let subscription = event.data.object as ExtendedSubscription,
      status = subscription.status,
      license: License = null;
  //console.log(`Stripe webhook invoked with event: ${event.type}`);
  let handled = true;
  switch (event.type) {
    case 'customer.deleted':
      const customer = event.data.object as Stripe.Customer;
      const _user = await findUserByCustomerId(customer.id);
      await updateUserById(_user.id, {
        stripeCustomerId: ''
      });
      break;
    /*case 'customer.created':
      let customer = event.data.object;
      const userId = parseInt(customer.metadata.userId);
      console.log(`Created customer with userId = `, userId);
      break;*/
    case 'customer.subscription.trial_will_end':
      //subscription = event.data.object;
      //status = subscription.status;
      //console.log(`Subscription status is ${status}. subscription: `, subscription);
      // Then define and call a method to handle the subscription trial ending.
      // handleSubscriptionTrialEnding(subscription);
      break;
    case 'customer.subscription.deleted':
      //subscription = event.data.object;
      //status = subscription.status;
      //console.log(`Subscription status is ${status}. subscription: `, subscription);
      // Then define and call a method to handle the subscription deleted.
      // handleSubscriptionDeleted(subscriptionDeleted);
      break;
    case 'customer.subscription.created':
      const customerId = subscription.customer as string;
      const user = await findUserByCustomerId(customerId);
      const product = await getProductFromPlanId(subscription.plan.id);
      license = await createLicense(
        user.id,
        parseInt(product.metadata['licenseId']),
        subscription.id,
        subscription.plan.id,
        subscription.status,
        subscription.cancel_at_period_end,
        new Date(subscription.current_period_end * 1000)
      );

      // Attach the ID to the subscription metadata
      await stripe.subscriptions.update(subscription.id, {
        metadata: {
          licenseId: license.id.toString(),
        },
      });
      
      console.debug(`Created user license: `, license);
      break;
    case 'customer.subscription.updated':
      try {
        const licenseId = parseInt(subscription.metadata.licenseId);
        if (Number.isNaN(licenseId))
          throw new Error(`License id not attached to subscription metadata: ${JSON.stringify(subscription)}`);

        license = await findLicenseById(licenseId);
        if (!license)
          throw new Error(`License not found for subscription: ${JSON.stringify(subscription)}`)

        license = await updateLicenseById(licenseId, {
          stripeSubscriptionStatus: subscription.status,
          stripeSubscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end,
          stripeSubscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000)
        });
        console.debug(`Updated user license: `, license);
      } catch (error) {
        console.error(`Caught error in 'customer.subscription.updated' webhook: `, error);
      }

      break;
    default:
      // Unexpected event type
      handled = false;
      break;
  }
  console.warn(`Stripe webhook... ${(handled) ? 'handled' : 'unhandled'} event type ${event.type}.`);
}


export {
  toPublicLicense,
  findLicenseById,
  findLicenseByUserId,
  createLicense,
  createFreeLicense,
  getStripeCustomers,
  getOrCreateCustomer,
  
  stripeWebhookHandler,
  stripe
}