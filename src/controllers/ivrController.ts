import { Request, Response } from 'express';
import EngagementMetrics from '../models/EngagementMetrics';
import User from '../models/User';
import logger from '../utils/logger';

export const getIVRWithUser = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const ivr = await EngagementMetrics.findOne({ sessionId });

    if (!ivr) {
      res.status(404).json({
        success: false,
        error: 'IVR session not found'
      });
      return;
    }

    const phone = ivr.phoneNumber;
    const phoneVariants = [
      phone,
      phone.replace(/^\+/, ''),
      phone.replace(/^\+234/, '0'),
      phone.replace(/^0/, '+234')
    ];
    
    const user = await User.findOne(
      { $or: [{ phoneNumber: { $in: phoneVariants } }, { phone: { $in: phoneVariants } }] },
      { firstName: 1, lastName: 1, email: 1, phone: 1, phoneNumber: 1, farm: 1, farmName: 1, primaryLivestock: 1, stateOfResidence: 1, address: 1, city: 1, farmLocation: 1, farmType: 1, farmSize: 1 }
    );

    res.json({
      success: true,
      data: {
        ivr,
        user: user || null
      }
    });
  } catch (error) {
    logger.error('Failed to get IVR with user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve IVR data'
    });
  }
};

export const getAllIVRWithUsers = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', phoneNumber } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const query = phoneNumber ? { phoneNumber: String(phoneNumber) } : {};
    
    const [ivrs, total] = await Promise.all([
      EngagementMetrics.find(query)
        .sort({ callStartTime: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      EngagementMetrics.countDocuments(query)
    ]);

    const phoneNumbers = [...new Set(ivrs.map(ivr => ivr.phoneNumber))];
    const allVariants = phoneNumbers.flatMap(phone => [
      phone,
      phone.replace(/^\+/, ''),
      phone.replace(/^\+234/, '0'),
      phone.replace(/^0/, '+234')
    ]);
    
    const users = await User.find(
      { $or: [{ phoneNumber: { $in: allVariants } }, { phone: { $in: allVariants } }] },
      { firstName: 1, lastName: 1, email: 1, phone: 1, phoneNumber: 1, farm: 1, farmName: 1, primaryLivestock: 1, stateOfResidence: 1, address: 1, city: 1, farmLocation: 1, farmType: 1, farmSize: 1 }
    );
    const userMap = new Map();
    
    users.forEach(user => {
      const userPhone = user.phoneNumber || user.phone;
      if (!userPhone) return;
      
      const variants = [
        userPhone,
        userPhone.replace(/^\+/, ''),
        userPhone.replace(/^\+234/, '0'),
        userPhone.replace(/^0/, '+234')
      ];
      phoneNumbers.forEach(phone => {
        if (variants.includes(phone)) {
          userMap.set(phone, user);
        }
      });
    });

    const data = ivrs.map(ivr => ({
      ivr,
      user: userMap.get(ivr.phoneNumber) || null
    }));

    res.json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('Failed to get all IVR with users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve IVR data'
    });
  }
};
