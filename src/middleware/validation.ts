import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import logger from '../utils/logger';

const africasTalkingWebhookSchema = Joi.object({
  sessionId: Joi.string().required(),
  phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/),
  networkCode: Joi.string(),
  dtmfDigits: Joi.string().pattern(/^[0-9*#]*$/),
  recordingUrl: Joi.string().uri(),
  durationInSeconds: Joi.number().integer().min(0),
  currencyCode: Joi.string(),
  amount: Joi.number(),
  hangupCause: Joi.string(),
}).options({ allowUnknown: true });

export const validateAfricasTalkingWebhook = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = africasTalkingWebhookSchema.validate(req.body);
  
  if (error) {
    logger.warn('Invalid Africa\'s Talking webhook data:', error.details);
    res.status(400).json({
      error: 'Invalid webhook data',
      details: error.details
    });
    return;
  }
  
  next();
};

export const validateDTMF = (req: Request, res: Response, next: NextFunction): void => {
  const { dtmfDigits } = req.body;
  
  if (dtmfDigits && !/^[0-9*#]+$/.test(dtmfDigits)) {
    logger.warn(`Invalid DTMF digits: ${dtmfDigits}`);
    res.status(400).json({
      error: 'Invalid DTMF digits'
    });
    return;
  }
  
  next();
};

export const logRequest = (req: Request, res: Response, next: NextFunction): void => {
  logger.info(`${req.method} ${req.path}`, {
    body: req.body,
    headers: req.headers,
    ip: req.ip
  });
  
  next();
};