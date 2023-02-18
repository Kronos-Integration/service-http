import { promisify } from "node:util";
import jwt from "jsonwebtoken";

export const verifyJWT = promisify(jwt.verify);
