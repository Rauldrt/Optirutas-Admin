import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const onStopCompleted = functions.firestore
  .document('delivery_stops/{stopId}')
  .onUpdate(async (change, context) => {
    const newValue = change.after.data();
    const oldValue = change.before.data();

    // Detect if completed changed from false to true
    if (newValue.completed === true && oldValue.completed === false) {
      if (!newValue.completedAt) {
        await change.after.ref.update({
          completedAt: Date.now()
        });
      }
    } 
    // If completed is unmarked (changed from true to false), delete completedAt
    else if (newValue.completed === false && oldValue.completed === true) {
      await change.after.ref.update({
        completedAt: admin.firestore.FieldValue.delete()
      });
    }
  });
