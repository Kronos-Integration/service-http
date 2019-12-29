import jwt from "jsonwebtoken";
import { promisify } from "util";

export const verifyJWT = promisify(jwt.verify);
