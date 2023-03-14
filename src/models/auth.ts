
interface User {
  id: number;

  name: string;
  username: string;
  email: string;
  password: string;

  emailVerified: boolean;
}

interface License {
  id: number;
  userId: number;
  licenseId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeSubscriptionStatus: string;
  stripeSubscriptionCancelAtPeriodEnd: boolean;
}

export {
  User, License
}