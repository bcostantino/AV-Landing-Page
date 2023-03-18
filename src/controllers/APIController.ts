import express from 'express';
import { findAllUsers, findUserById, toPublicUser } from '../auth';
import * as encryption from '../crypto';

const getUsers_REST = async (req: express.Request, res: express.Response) => {
  const users = await findAllUsers();
  //console.log('users: ', users);
  const publicUsers = await Promise.all(users.map(e => toPublicUser(e)));
  //console.log('public users: ', publicUsers);
  res.json({
    users: publicUsers
  });
}

const getUser_REST = async (req: express.Request, res: express.Response) => {
  const { user_id } = req.params;
  try {
    const userId = encryption.decrypt(user_id);
    //console.log('getting user for user id: ', user_id);
    const user = await findUserById(userId);
    res.json({
      user: (await toPublicUser(user))
    });
  } catch (error) {
    console.error(error);
    res.status(400).send();
  }
}

export {
  getUsers_REST,
  getUser_REST
}