import * as mysql from 'mysql';

const config = {
  host    : 'localhost',
  user    : 'av_business',
  password: 'YWanqz3imyfJ@8w#BUpC',
  database: 'autoviz_business'
};
const connection = mysql.createConnection(config);

/** see https://darifnemma.medium.com/how-to-interact-with-mysql-database-using-async-await-promises-in-node-js-9e6c81b683da */
const dbQuery = (query: string, params?: any[]): Promise<any[]> => {
  return new Promise((resolve,reject) => {
    connection.query(query, params, function(err, results) {
      if (err) {
        return reject(err);
      }
      return resolve(results);
    });
  });
}

export {
  config as MySQLConnectionConfig,
  dbQuery
}