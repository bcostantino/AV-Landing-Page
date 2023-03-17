
/** see https://www.digitalocean.com/community/tutorials/nodejs-jwt-expressjs */
import dotenv from 'dotenv';
dotenv.config();   // get config vars

/** imports */
import express from 'express';
import session from 'express-session';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { dbTest, createUser, findUserByEmail, validateEmail, validateLogin, sendEmailVerification, findActiveUserEmailVerificationByKey, deactivateUserEmailVerificationById, setUserEmailVerifiedById, generateUUID, toPublicUser, findUserByCustomerId, findUserById, verifyEmail } from './auth';
import { createFreeLicense, findLicenseByUserId, getOrCreateCustomer, getStripeCustomers, stripe, stripeWebhookHandler } from './licensing';
import { PublicUser, User } from './models/auth';
import * as encryption from './crypto';
import { MySQLConnectionConfig } from './db';

const app = express();
const MySQLStore = require('express-mysql-session')(session);

/**
 * 
 * @param payload Object with client data
 * @param exp Expiratioon in seconds from creation
 * @returns 
 */
function generateAccessToken(payload, exp = 1800) {
  return jwt.sign({ 
    ...payload, 
    exp: Math.floor(Date.now() / 1000) + exp,
    jti: generateUUID()
  }, process.env.JWT_TOKEN_SECRET);
}

function authenticateToken(req: express.Request, res: express.Response, next) {
  //const authHeader = req.headers['authorization'];
  //const token = authHeader && authHeader.split(' ')[1];
  /** use cookie instead of auth header */
  const token = req.cookies['token'];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_TOKEN_SECRET, (err, payload) => {

    if (err) {
      console.warn('Caught exception in jwt verificaton... ', err);
      //return res.sendStatus(403);
      return res.redirect('/login');
    }

    res.locals.jwtPayload = payload;

    next();
  });
}

app.set('view engine', 'ejs');
app.use('/static', express.static(path.join(path.resolve(__dirname, '..'), 'static')));
app.use(express.urlencoded({ extended: true }));
app.use(session({ 
  secret: 'randomstuffhere', 
  resave: true, 
  saveUninitialized: true,
  store: new MySQLStore({
    ...MySQLConnectionConfig,
    clearExpired: true,
    checkExpirationInterval: 900000, // 15 minutes
    expiration: 86400000, // 1 day
  })
}));
app.use(cookieParser());

//const PORT = 4242;
const DOMAIN = `http://${process.env.HOST}:${process.env.PORT}`;

/*   BILLING ROUTES    */
app.post('/billing/webhook', express.raw({ type: "*/*" }), async (request, response) => {
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
      console.error(`${new Date().toLocaleString()} [⚠️]: Webhook signature verification failed.`, err.message);
      return response.sendStatus(400);
    }
  }

  // Handle the event
  await stripeWebhookHandler(event);

  // Return a 200 response to acknowledge receipt of the event
  response.send();
});

app.use(express.json());

app.get('/billing', authenticateToken, (req, res) => {
  res.render('billing/checkout');
});

app.post('/billing/create-checkout-session', authenticateToken, async (req, res) => {
  const lookupKey = req.body.lookup_key as string;
  if (!lookupKey)
    return res.sendStatus(400);

  const user = await findUserById((res.locals.jwtPayload.context.user as User).id);
  if (!user) return res.sendStatus(401);
  //console.log(user);
  if (!user.emailVerified)
    return res.sendStatus(401);

  if (lookupKey === 'av-free') {
    const license = await createFreeLicense(user);
    return res.sendStatus(201);
  }

  //console.log('retrieved user from jwt: ', user);

  const customerId = await getOrCreateCustomer(user.id.toString(), user.email);
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], expand: ['data.product'], });
  
  const session = await stripe.checkout.sessions.create({
    billing_address_collection: 'auto',
    line_items: [
      {
        price: prices.data[0].id,
        quantity: 1, // For metered billing, do not pass quantity
      },
    ],
    mode: 'subscription',
    success_url: `${DOMAIN}/portal?billing=success&session_id={CHECKOUT_SESSION_ID}`,//`${DOMAIN}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${DOMAIN}/portal?billing=cancel`, //`${DOMAIN}/billing/cancel`,
    customer: customerId,
  });

  res.status(303).json({ url: session.url }); //res.redirect(303, session.url);
});

app.post('/billing/create-portal-session', authenticateToken, async (req, res) => {
  // For demonstration purposes, we're using the Checkout session to retrieve the customer ID.
  // Typically this is stored alongside the authenticated user in your database.
  const { session_id, customer_id } = req.body;
  if (!(session_id || customer_id))
    return res.sendStatus(400);
  
  const customer = ((session_id) ? (await stripe.checkout.sessions.retrieve(session_id)).customer : customer_id) as string;
  if (!customer)
    return res.sendStatus(404);

  // This is the url to which the customer will be redirected when they are done
  // managing their billing with the portal.
  //const returnUrl = ;

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customer, //checkoutSession.customer as string,
    return_url: `${DOMAIN}/portal` //returnUrl,
  });

  res.json({ url: portalSession.url }); //res.redirect(303, portalSession.url);
});


app.get('/billing/success', (req, res) => {
  res.render('billing/success');
});

app.get('/billing/cancel', (req,res) => {
  res.render('billing/cancel');
});


/**********************/
/** regular routes */
/**********************/



/** public routes */

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




/** see https://www.rfc-editor.org/rfc/rfc7519 */
const login = async (req: express.Request, res: express.Response, user: User) => {
  req.session['loggedIn'] = true;
  req.session['user'] = user;

  const exp = 1800;
  const token = generateAccessToken({ 
    context: {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email
      }, //await toPublicUser(user),
    },
    iss: 'autoviz-home',
    sub: user.name.split(' ')[0].toLocaleLowerCase(),
    aud: ["all"]
  }, exp);

  res.setHeader('Set-Cookie', [`token=${token}; Max-Age=${exp}; HttpOnly`]);
}

const logout = async (req: express.Request, res: express.Response) => {
  req.session['loggedIn'] = false;
  req.session['user'] = null;
  res.setHeader('Set-Cookie', [`token=`]);
}

app.post('/signup', async (req,res) => {
  const { name, email, password, passwordConfirm } = req.body;

  if (!(name && email && password)) return res.sendStatus(400);
  if (password !== passwordConfirm) return res.sendStatus(400);
  if (!validateEmail(email)) return res.sendStatus(400);

  const existingUser = await findUserByEmail(email);
  if (existingUser) return res.sendStatus(409);

  const user = await createUser(name, email, password);
  console.log('created user: ', user);

  await sendEmailVerification(user);
  await login(req, res, user);

  res.status(201).send();
});

app.post('/signin', async (req,res) => {
  const { email, password } = req.body;

  const user = await findUserByEmail(email);
  if (!user) return res.status(400).send();

  if (!(await validateLogin(user, password))) {
    return res.status(400).send();
  }

  await login(req,res,user);
  
  res.status(200).send();
});

app.get('/signout', async (req, res) => {
  await logout(req, res);
  res.redirect('/');
});

app.get('/resend-email-verification', authenticateToken, async (req, res) => {
  const user = await findUserById((res.locals.jwtPayload.context.user as User).id);
  //console.log(user);
  if (user.emailVerified)
    return res.sendStatus(403);

  await sendEmailVerification(user);
  res.send();  
});

app.get('/verify-email/:verification_key', async (req, res) => {
  const verificationKey = req.params['verification_key'];
  const status = await verifyEmail(verificationKey);

  if (status === 'inactive')
    return res.status(410).send('Verification link inactive');

  if (status === 'expired')
    return res.status(498).send('Verification link expired');

  res.redirect('/signin');  
});

/* verify user information to access profile */
const hardAuthorize = async (req: express.Request, res: express.Response, next) => {
  if (!req.session['user'])
    return res.redirect('/signin'); //return res.sendStatus(401);

  console.debug('hardAuthorize: request session data: ', req.session);

  const user = await findUserById((res.locals.jwtPayload.context.user as User).id);
  const license = await findLicenseByUserId(user.id);

  //console.log('jwt payload: ', res.locals.jwtPayload, 'request session: ', req.session);

  res.locals.user = {
    id: encryption.encrypt(user.id.toString()),
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    stripeCustomerId: user.stripeCustomerId,
    license: license
  }
  res.locals.logged_in = true;

  console.log(res.locals);

  next();
};

app.get('/portal', authenticateToken, hardAuthorize, async (req,res) => {
  res.render('portal');
});

app.listen(process.env.PORT, () => console.log('Running on port 4242'));