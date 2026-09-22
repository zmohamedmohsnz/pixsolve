import { Resend } from 'resend';
import config from './env.js';

const resend = new Resend(config.email.apiKey);

export default resend;