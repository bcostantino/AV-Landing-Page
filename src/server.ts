
/** see https://www.digitalocean.com/community/tutorials/nodejs-jwt-expressjs */
import dotenv from 'dotenv';
dotenv.config();   // get config vars

/** imports */
import express from 'express';
import session from 'express-session';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { dbTest, createUser, findUserByEmail, validateEmail, validateLogin, sendEmailVerification, findActiveUserEmailVerificationByKey, deactivateUserEmailVerificationById, setUserEmailVerifiedById, generateUUID } from './auth';
import { getStripeCustomers, stripe, stripeWebhookHandler } from './licensing';
import { User } from './models/auth';

const app = express();

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

    //req.locals.jwtPayload = payload;
    //req.session['jwtPayload'] = payload;
    res.locals.jwtPayload = payload;

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
app.get('/billing', authenticateToken, (req, res) => {
  res.render('billing/checkout');
});

app.post('/billing/create-checkout-session', authenticateToken, async (req, res) => {
  const user = req.session['jwtPayload'];
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
    client_reference_id: user,
    success_url: `${DOMAIN}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${DOMAIN}/billing/cancel`,
  });

  res.redirect(303, session.url);
});

app.post('/billing/create-portal-session', authenticateToken, async (req, res) => {
  // For demonstration purposes, we're using the Checkout session to retrieve the customer ID.
  // Typically this is stored alongside the authenticated user in your database.
  const { session_id } = req.body;
  const checkoutSession = await stripe.checkout.sessions.retrieve(session_id);

  // This is the url to which the customer will be redirected when they are done
  // managing their billing with the portal.
  const returnUrl = `${DOMAIN}`;

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

  // Handle the event
  stripeWebhookHandler(event);

  // Return a 200 response to acknowledge receipt of the event
  response.send();
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

/** see https://www.rfc-editor.org/rfc/rfc7519 */
const login = (req: express.Request, res: express.Response, user: User) => {
  req.session['loggedIn'] = true;
  req.session['user'] = user;

  const exp = 1800;
  const token = generateAccessToken({ 
    context: {
      user: user,
    },
    iss: 'autoviz-home',
    sub: user.name.split(' ')[0].toLocaleLowerCase(),
    aud: ["all"]
  }, exp);

  res.setHeader('Set-Cookie', [`token=${token}; Max-Age=${exp}; HttpOnly`]);
}

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

  login(req, res, user);
  res.status(201).send();
});

app.post('/signin', async (req,res) => {
  const { email, password } = req.body;

  const user = await findUserByEmail(email);
  if (!user) return res.status(400).send();

  if (!(await validateLogin(user, password))) {
    return res.status(400).send();
  }

  login(req,res,user);
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
  if (!req.session['user'])
    return res.sendStatus(401);

  console.log('jwt payload: ', res.locals.jwtPayload, 'request session: ', req.session);

  res.locals.user = req.session['user'];
  res.locals.logged_in = true;

  if (!req.session['user']['email_verified']) 
    res.locals.alert = "You need to verify your email";

  //console.log('getting stripe customers!');
  //await getStripeCustomers();
  
  res.render('profile');
});

app.listen(PORT, () => console.log('Running on port 4242'));