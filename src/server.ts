//const express = require('express');
//const session = require('express-session');
//const path = require('path');
//const jwt = require('jsonwebtoken');
//const { dbTest, createUser, findUserByEmail, validateEmail, validateLogin } = require('./auth')
//const cookieParser = require("cookie-parser");
import express from 'express';
import session from 'express-session';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { dbTest, createUser, findUserByEmail, validateEmail, validateLogin, sendEmailVerification, findActiveUserEmailVerificationByKey, deactivateUserEmailVerificationById, setUserEmailVerifiedById } from './auth';

/** see https://www.digitalocean.com/community/tutorials/nodejs-jwt-expressjs */
import dotenv from 'dotenv';
dotenv.config();   // get config vars

// This is your test secret API key.
const stripe = require('stripe')(process.env.STRIPE_API_KEY /*'sk_test_51MfAswDOqtt0qJJAK3BSTOyAI3GsMpl5P62VFVd8t3IjknPD0vj2EPEoTphLZuvS3JzUWUsfGBljEK0nRX97XcLa00XLQ6rgEO'*/);

const app = express();


function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_TOKEN_SECRET, { expiresIn: '1800s' });
}

function authenticateToken(req, res, next) {
  //const authHeader = req.headers['authorization'];
  //const token = authHeader && authHeader.split(' ')[1];
  /** use cookie instead of auth header */
  const token = req.cookies['token'];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_TOKEN_SECRET, (err, payload) => {

    if (err) {
      console.error(err);
      return res.sendStatus(403);
    }

    req.jwtPayload = payload;

    next();
  });
}

app.set('view engine', 'ejs');
app.use('/static', express.static(path.join(path.resolve(__dirname, '..'), 'static')));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'randomstuffhere', resave: true, saveUninitialized: true }));
app.use(cookieParser());

const PORT = 4242;
const DOMAIN = `http://localhost:${PORT}`;


/*   BILLING ROUTES    */
app.get('/billing', (req, res) => {
  res.render('billing/checkout');
});

app.get('/billing/success', (req, res) => {
  res.render('billing/success');
});

app.get('/billing/cancel', (req,res) => {
  res.render('billing/cancel');
});

app.post('/billing/create-checkout-session', async (req, res) => {
  const prices = await stripe.prices.list({
    lookup_keys: [req.body.lookup_key],
    expand: ['data.product'],
  });
  const session = await stripe.checkout.sessions.create({
    billing_address_collection: 'auto',
    line_items: [
      {
        price: prices.data[0].id,
        // For metered billing, do not pass quantity
        quantity: 1,

      },
    ],
    mode: 'subscription',
    success_url: `${DOMAIN}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${DOMAIN}/billing/cancel`,
  });

  res.redirect(303, session.url);
});

app.post('/billing/create-portal-session', async (req, res) => {
  // For demonstration purposes, we're using the Checkout session to retrieve the customer ID.
  // Typically this is stored alongside the authenticated user in your database.
  const { session_id } = req.body;
  const checkoutSession = await stripe.checkout.sessions.retrieve(session_id);

  // This is the url to which the customer will be redirected when they are done
  // managing their billing with the portal.
  const returnUrl = DOMAIN;

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: checkoutSession.customer,
    return_url: returnUrl,
  });

  res.redirect(303, portalSession.url);
});

app.post('/billing/webhook', express.raw({ type: "*/*" }), (request, response) => {
  //console.log('idk what happens in the webhook');
  let event = request.body;
  // Replace this endpoint secret with your endpoint's unique secret
  // If you are testing with the CLI, find the secret by running 'stripe listen'
  // If you are using an endpoint defined with the API or dashboard, look in your webhook settings
  // at https://dashboard.stripe.com/webhooks { type: 'application/json' }
  //const endpointSecret = 'whsec_12345';
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; //'whsec_58c0e0a1909e25b55e06da931202be7579e2c04ce515999ca7fd9b76b8c8c819';
  // Only verify the event if you have an endpoint secret defined.
  // Otherwise use the basic event deserialized with JSON.parse
  if (endpointSecret) {
    // Get the signature sent by Stripe
    const signature = request.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(
        request.body,
        signature,
        endpointSecret
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`, err.message);
      return response.sendStatus(400);
    }
  }
  let subscription;
  let status;
  // Handle the event
  console.log(`Stripe webhook invoked with event: ${event.type}`);
  switch (event.type) {
    case 'customer.subscription.trial_will_end':
      subscription = event.data.object;
      status = subscription.status;
      console.log(`Subscription status is ${status}.`);
      // Then define and call a method to handle the subscription trial ending.
      // handleSubscriptionTrialEnding(subscription);
      break;
    case 'customer.subscription.deleted':
      subscription = event.data.object;
      status = subscription.status;
      console.log(`Subscription status is ${status}.`);
      // Then define and call a method to handle the subscription deleted.
      // handleSubscriptionDeleted(subscriptionDeleted);
      break;
    case 'customer.subscription.created':
      subscription = event.data.object;
      status = subscription.status;
      console.log(`Subscription status is ${status}.`);
      // Then define and call a method to handle the subscription created.
      // handleSubscriptionCreated(subscription);
      break;
    case 'customer.subscription.updated':
      subscription = event.data.object;
      status = subscription.status;
      console.log(`Subscription status is ${status}.`);
      // Then define and call a method to handle the subscription update.
      // handleSubscriptionUpdated(subscription);
      break;
    default:
      // Unexpected event type
      console.log(`Unhandled event type ${event.type}.`);
  }
  // Return a 200 response to acknowledge receipt of the event
  response.send();
});

app.use(express.json());


app.get('/', (req,res) => {
  res.render('index');
});

app.post('/join-waiting-list', (req, res) => {
  const { email } = req.body;
  console.log(email);
  res.status(200).send();
});

app.post('/join-newsletter', (req,res) => {
  const { email } = req.body;
  console.log(email);
  res.status(200).send();
});

app.post('/contact', (req,res) => {
  const { name, email, subject, message } = req.body;
  console.log(name, email, subject, message);
  res.status(200).send();
});

app.get('/signup', (req,res) => {
  res.render('signup');
});

app.get('/signin', (req,res) => {
  res.render('signin');
});

app.post('/signup', async (req,res) => {
  const { name, email, password, passwordConfirm } = req.body;

  if (!name || !email || !password) return res.sendStatus(400);
  if (password !== passwordConfirm) return res.sendStatus(400);
  if (!validateEmail(email)) return res.sendStatus(400);

  const existingUser = await findUserByEmail(email);
  if (existingUser) return res.sendStatus(409);

  const user = await createUser(name, email, password);
  console.log('created user: ', user);

  await sendEmailVerification(user);

  req.session['user'] = user;
  const token = generateAccessToken({ 
    user: {
      email: user.email
    }
  });

  res.setHeader('Set-Cookie', [`token=${token}; HttpOnly`]);

  res.status(201).send();
});

app.post('/signin', async (req,res) => {
  const { email, password } = req.body;

  const user = await findUserByEmail(email);
  if (!user) return res.status(400).send();

  if (!(await validateLogin(user, password))) {
    return res.status(400).send();
  }

  req.session['loggedIn'] = true;
  req.session['user'] = user;

  const token = generateAccessToken({ 
    user: {
      email: user.email
    }
  });

  res.setHeader('Set-Cookie', [`token=${token}; HttpOnly`]);
  res.status(200).send();
});

app.get('/verify-email/:verification_key', async (req, res) => {
  const verificationKey = req.params['verification_key'];
  const verification = await findActiveUserEmailVerificationByKey(verificationKey);

  if (!verification)
    return res.status(410).send('Verification link inactive');
  
  if (new Date() > verification['expires_at']) {
    await deactivateUserEmailVerificationById(verification['id']);
    return res.status(498).send('Verification link expired');
  }

  await setUserEmailVerifiedById(verification['user_id']);
  await deactivateUserEmailVerificationById(verification['id']);

  console.log(verificationKey, verification);

  res.redirect('/signin');
});

app.get('/profile', authenticateToken, async (req,res) => {
  console.log(req.session);
  res.locals.user = req.session['user'];
  if (!req.session['user']['email_verified']) res.locals.alert = "You need to verify your email";
  res.render('profile');
});

app.listen(PORT, () => console.log('Running on port 4242'));