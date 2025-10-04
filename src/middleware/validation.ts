import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import logger from '../utils/logger';

const africasTalkingWebhookSchema = Joi.object({
  sessionId: Joi.string().required(),
  phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/),
  callerNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/),
  destinationNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/),
  networkCode: Joi.string(),
  direction: Joi.string(),
  isActive: Joi.string().valid('0', '1'),
  callSessionState: Joi.string(),
  status: Joi.string(),
  dtmfDigits: Joi.string().pattern(/^[0-9*#]*$/),
  recordingUrl: Joi.string().uri(),
  callRecordingUrl: Joi.string().uri(),
  durationInSeconds: Joi.alternatives().try(Joi.number().integer().min(0), Joi.string().pattern(/^\d+$/)),
  callRecordingDurationInSeconds: Joi.number().integer().min(0),
  currencyCode: Joi.string(),
  amount: Joi.number(),
  hangupCause: Joi.string(),
  callStartTime: Joi.string(),
  callEndTime: Joi.string(),
  callType: Joi.string(),
  callStatus: Joi.string(),
  callEndReason: Joi.string(),
  callerCountryCode: Joi.string(),
  callerCarrierName: Joi.string(),
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