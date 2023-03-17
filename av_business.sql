CREATE TABLE autoviz_business.users (
  id                  MEDIUMINT       NOT NULL AUTO_INCREMENT,

  name                varchar(255)    NOT NULL,
  username            varchar(255)    NOT NULL,
  email               varchar(255)    UNIQUE NOT NULL,
  password            varchar(1000)   NOT NULL,

  email_verified      BOOLEAN         NOT NULL DEFAULT FALSE,

  stripe_customer_id  varchar(255),

  active                                    BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at                                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id)
);

CREATE TABLE autoviz_business.user_email_verification (
  id          MEDIUMINT       NOT NULL AUTO_INCREMENT,

  user_id     MEDIUMINT       NOT NULL,
  _key        varchar(255)    NOT NULL,
  expires_at  DATETIME        NOT NULL,
  active      BOOLEAN         NOT NULL DEFAULT TRUE,

  PRIMARY KEY (id)
);

CREATE TABLE autoviz_business.user_licenses (
  id                                        MEDIUMINT       NOT NULL AUTO_INCREMENT,
  user_id                                   MEDIUMINT       NOT NULL,

  license_id                                MEDIUMINT       NOT NULL,
  stripe_subscription_id                    varchar(255),
  stripe_subscription_plan_id               varchar(255),
  stripe_subscription_status                varchar(255),
  stripe_subscription_cancel_at_period_end  BOOLEAN,
  stripe_subscription_current_period_end    DATETIME,

  active                                    BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at                                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id)
);