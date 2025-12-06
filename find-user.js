const mongoose = require('mongoose');

async function findUser() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
  
  const phone = '+2349119073498';
  const phoneVariants = [phone, phone.replace('+', ''), '0' + phone.slice(4)];
  
  console.log('Searching for phone variants:', phoneVariants);
  
  const collectionsToCheck = ['users', 'farmerprofiles', 'sessions', 'conversations', 'subscriptions'];
  
  for (const colName of collectionsToCheck) {
    const count = await mongoose.connection.db.collection(colName).countDocuments();
    console.log(`\n${colName}: ${count} documents`);
    
    if (count > 0) {
      const sample = await mongoose.connection.db.collection(colName).findOne({});
      console.log('Sample structure:', Object.keys(sample));
      
      for (const variant of phoneVariants) {
        const doc = await mongoose.connection.db.collection(colName).findOne({ phoneNumber: variant });
        if (doc) {
          console.log(`Found in ${colName} with ${variant}:`);
          console.log(JSON.stringify(doc, null, 2));
          break;
        }
      }
    }
  }
  
  await mongoose.disconnect();
}

findUser().catch(console.error);
