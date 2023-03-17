
interface User {
  id: number;

  name: string;
  username: string;
  email: string;
  password: string;

  stripeCustomerId: string;

  emailVerified: boolean;

  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface UserUpdate {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
  stripeCustomerId?: string;
  emailVerified?: boolean;
  active?: boolean;
}

interface PublicUser {
  id: string;
  name: string;
  username: string;
  email: string;
  stripeCustomerId: string;
  emailVerified: boolean;
  license: PublicLicense;
}

interface License {
  id: number;
  userId: number;
  licenseId: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionPlanId?: string;
  stripeSubscriptionStatus?: string;
  stripeSubscriptionCancelAtPeriodEnd?: boolean;
  stripeSubscriptionCurrentPeriodEnd?: Date;

  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface PublicLicense {
  id: string;
  userId: string;
  licenseId: string;
}

export {
  User,
  UserUpdate,
  License,
  PublicUser,
  PublicLicense
}