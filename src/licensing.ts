import { getRandomString } from './auth';
import { dbQuery } from './db';
import { User, License } from './models/auth';

const stripe = require('stripe')(process.env.STRIPE_API_KEY /*'sk_test_51MfAswDOqtt0qJJAK3BSTOyAI3GsMpl5P62VFVd8t3IjknPD0vj2EPEoTphLZuvS3JzUWUsfGBljEK0nRX97XcLa00XLQ6rgEO'*/);
const STRIPE_API_BASE_URL = 'https://api.stripe.com';

const licenseFromDbResult = (result: any) => {
  return <License> {
    id: result['id'],
    userId: result['user_id'],
    licenseId: result['license_id'],
    stripeCustomerId: result['stripe_customer_id'],
    stripeSubscriptionId: result['stripe_subscription_id'],
    stripeSubscriptionStatus: result['stripe_subscription_status'],
    stripeSubscriptionCancelAtPeriodEnd: result['stripe_subscription_cancel_at_period_end']
  };
}

const findLicenseById = async (id: number) => {
  const results = await dbQuery('SELECT * FROM user_licenses WHERE id = ?', [id]);
  return (results.length) ? licenseFromDbResult(results[0]) : null;
}

const createLicense = async (user: User, licenseId: string, customerId: string, subscriptionId: string, subscriptionStatus: string, subscriptionCancelAtPeriodEnd: boolean) => {
  const results = await dbQuery(`INSERT INTO user_licenses(user_id,license_id,stripe_customer_id,stripe_subscription_id,stripe_subscription_status,stripe_subscription_cancel_at_period_end)
                                  VALUES(?,?,?,?,?,?)`, [user.id, licenseId, customerId, subscriptionId, subscriptionStatus, subscriptionCancelAtPeriodEnd]);
  
  return (await findLicenseById(results['insertId']));
}

const getStripeCustomers = async () => {
  const customers = await stripe.customers.list({ limit: 3 },   {
    apiKey: process.env.STRIPE_API_KEY
  });
  console.log('customers: ', customers);
}

const stripeWebhookHandler = (event) => {
  let subscription = event.data.object,
      status = subscription.status;
  //console.log(`Stripe webhook invoked with event: ${event.type}`);
  let handled = true;
  switch (event.type) {
    case 'customer.subscription.trial_will_end':
      //subscription = event.data.object;
      //status = subscription.status;
      console.log(`Subscription status is ${status}. subscription: `, subscription);
      // Then define and call a method to handle the subscription trial ending.
      // handleSubscriptionTrialEnding(subscription);
      break;
    case 'customer.subscription.deleted':
      //subscription = event.data.object;
      //status = subscription.status;
      console.log(`Subscription status is ${status}. subscription: `, subscription);
      // Then define and call a method to handle the subscription deleted.
      // handleSubscriptionDeleted(subscriptionDeleted);
      break;
    case 'customer.subscription.created':
      //subscription = event.data.object;
      //status = subscription.status;
      console.log(`Subscription status is ${status}. subscription: `, subscription);
      // Then define and call a method to handle the subscription created.
      // handleSubscriptionCreated(subscription);
      break;
    case 'customer.subscription.updated':
      //subscription = event.data.object;
      //status = subscription.status;
      console.log(`Subscription status is ${status}. subscription: `, subscription);
      // Then define and call a method to handle the subscription update.
      // handleSubscriptionUpdated(subscription);
      break;
    default:
      // Unexpected event type
      handled = false;
      break;
  }
  console.warn(`Stripe webhook... ${(handled) ? 'handled' : 'unhandled'} event type ${event.type}.`);
}


export {
  findLicenseById,
  createLicense,
  getStripeCustomers,
  
  stripeWebhookHandler,
  stripe
}