CREATE TABLE autoviz_business.users (
  id        MEDIUMINT       NOT NULL AUTO_INCREMENT,

  name      varchar(255)    NOT NULL,
  username  varchar(255)    NOT NULL,
  email     varchar(255)    UNIQUE NOT NULL,
  password  varchar(1000)   NOT NULL,

  email_verified    BOOLEAN NOT NULL DEFAULT FALSE,

  PRIMARY KEY (id)
);