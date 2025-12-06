import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  [key: string]: any;
}

const UserSchema: Schema = new Schema({}, {
  strict: false,
  collection: 'users'
});

export default mongoose.model<IUser>('User', UserSchema);
