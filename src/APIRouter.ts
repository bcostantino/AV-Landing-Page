import express from "express";
import { getUser_REST, getUsers_REST } from "./controllers/APIController";
const router = express.Router();

router.get('/users', getUsers_REST);
router.get('/user/:user_id', getUser_REST);

export {
  router as APIRouter
}