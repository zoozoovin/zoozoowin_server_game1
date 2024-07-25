const express = require("express");
const schedule = require("node-schedule");
const database = require("./firebase");
const { ref, get, set, update } = require("firebase/database");

const app = express();
const PORT = process.env.PORT || 3000;

// const admin = require("firebase-admin");

// const serviceAccount = require("./zoozoovin-86d2e-firebase-adminsdk-csbnn-61177e0936.json");

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),

//   databaseURL: "https://zoozoovin-86d2e-default-rtdb.firebaseio.com",
// });

// Function to send notification
// const sendNotification = async (fcmToken, title, body) => {
//   const message = {
//     token: fcmToken,
//     notification: {
//       title: title,
//       body: body,
//     },
//     data: {
//       key1: "Zoozoowin",
//     },
//     android: {
//       priority: "high",
//     },
//   };

//   try {
//     const response = await admin.messaging().send(message);
//     console.log("Successfully sent message:", response);
//   } catch (error) {
//     console.log("Error sending message:", error);
//   }
// };
// // const token =
// //   "d42RtBjxTNOCZFhrbGURcT:APA91bH9aSxYQLO3UPnbEZoeSJrCk3CsBZrq87ZFuNamBZXVCZV-jJQBjSyX6iB55GdN1PnGyVT7dCbp0fOunSe8YbMwfnBhT0Mxkd-i0iq8NQ7Bt1nhInAO1bQjGPn8mhp3gAkeljRQ";
// // sendNotification(token, "hello", "test");

// // Function to fetch notifications
// async function fetchNotifications(phone) {
//   const ref = admin.database().ref(`notification/${phone}`);

//   try {
//     const snapshot = await ref.once("value");
//     if (snapshot.exists()) {
//       const notifications = snapshot.val();
//       console.log("Fetched notifications:", notifications);
//       return notifications;
//     } else {
//       console.log("No notifications found");
//       return {};
//     }
//   } catch (error) {
//     console.error("Error fetching notifications:", error);
//     return {};
//   }
// }

// // Function to add a new notification
// async function addNotification(
//   phone,
//   title,
//   formattedDate,
//   formattedTime,
//   type
// ) {
//   const ref = admin.database().ref(`notification/${phone}`);

//   try {
//     // Fetch existing notifications
//     const notifications = await fetchNotifications(phone);

//     // Check if there are notifications for the specific date
//     if (notifications[formattedDate]) {
//       notifications[formattedDate].push({
//         title: title,
//         date: formattedDate,
//         time: formattedTime,
//         type: type,
//       });
//     } else {
//       notifications[formattedDate] = [
//         {
//           title: title,
//           date: formattedDate,
//           time: formattedTime,
//           type: type,
//         },
//       ];
//     }

//     // Update the database with the new notification list
//     await ref.update({
//       [formattedDate]: notifications[formattedDate],
//     });

//     console.log("Notification added successfully");
//   } catch (error) {
//     console.error("Error adding notification:", error);
//   }
// }

// Function to fetch and process data
async function fetchAndProcessData() {
  // Fetch the current GMT time
  const now = new Date();

  // Convert GMT time to IST (GMT + 5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;

  const istTime = new Date(now.getTime()  +istOffset);

  const formattedDate = `${istTime.getDate().toString().padStart(2, "0")}-${(
    istTime.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}-${istTime.getFullYear()}`;
  let hour = istTime.getHours();
  // let istHour = new Date(now.getTime()).getHours();

  const period = hour >= 12 ? "PM" : "AM";
  let displayHour = hour % 12 || 12; // Converts 0 to 12 for 12-hour format
  const formattedDisplayHour = displayHour.toString().padStart(2, "0"); // Ensures two-digit hour

  const formattedHour = `${formattedDisplayHour}:00 ${period}`;

  const refPath = `Game1/${formattedDate}_${formattedHour}`;

  console.log(refPath);
  const dataRef = ref(database, refPath);

  // Check if the IST time slot is between 12 PM to 11 PM
  if (hour < 12 || hour > 23) {
    console.log(
      "Time slot is outside 12 PM to 11 PM IST. No game data to process."
    );

    return;
  }

  try {
    const snapshot = await get(dataRef);
    const gameData = snapshot.val();
    console.log("===============GAME DATA=================");
    console.log(gameData);

    if (!gameData) {
      console.log("No game data found.");
      const randomLeastSelectedCard = `c${Math.floor(Math.random() * 12) + 1}`;
      console.log("Randomly selected card:", randomLeastSelectedCard);
      await set(
        ref(database, `result_game1/${formattedDate}_${formattedHour}`),
        {
          cardWon: randomLeastSelectedCard,
          totalGameCollection: 0,
          amountToSpent: 0,
          amountLeft: 0,
        }
      );
      return null;
    }

    // Create an empty Map to store card ID and total amount pairs
    const cardTotalAmountMap = new Map();

    // Iterate over each player's selected cards
    Object.values(gameData).forEach((player) => {
      if (player.selectedCards) {
        // Iterate over each card in the player's selected cards
        player.selectedCards.forEach((cardData) => {
          const { cardId, amount } = cardData;

          // If the card ID already exists in the map, add the amount to its total
          if (cardTotalAmountMap.has(cardId)) {
            cardTotalAmountMap.set(
              cardId,
              cardTotalAmountMap.get(cardId) + amount
            );
          } else {
            // Otherwise, initialize the total amount for the card ID
            cardTotalAmountMap.set(cardId, amount);
          }
        });
      }
    });

    // At this point, cardTotalAmountMap contains the total amount for each card ID
    // Now, find the card with the minimum total amount
    let leastSelectedCard = null;
    let minAmount = Infinity;
    let totalAmount = 0;
    let amountSpent = 0;

    // Iterate over the entries of the map to find the least selected card
    for (const [cardId, Amount] of cardTotalAmountMap) {
      if (Amount < minAmount) {
        minAmount = Amount;
        leastSelectedCard = cardId;
      }
      totalAmount += Amount;
    }

    console.log("=================leastselected card ==================");
    console.log(leastSelectedCard);

    if (!leastSelectedCard) {
      const randomLeastSelectedCard = `c${Math.floor(Math.random() * 12) + 1}`;
      console.log("Randomly selected card:", randomLeastSelectedCard);
      await set(
        ref(database, `result_game1/${formattedDate}_${formattedHour}`),
        {
          cardWon: randomLeastSelectedCard,
          totalGameCollection: 0,
          amountToSpent: 0,
          amountLeft: 0,
        }
      );
      return null;
    }

    // Check if the least selected card is present for any player
    // for (const player of Object.values(gameData)) {
    //   const mobile = player.mobile;
    //   console.log(mobile);
    //   if (player.selectedCards) {
    //     for (const cardData of player.selectedCards) {
    //       console.log(cardData);
    //       console.log(cardData.amount);
    //       if (cardData.cardId === leastSelectedCard) {
    //         let winAmount = cardData.amount * 2;
    //         console.log("================win amount ===============");
    //         console.log(winAmount);
    //         const userRef = ref(database, `username/${mobile}`);
    //         const userSnapshot = await get(userRef);
    //         const userData = userSnapshot.val();
    //         console.log(userData);
    //         if (userData) {
    //           const newAmount = userData.walletBalance + winAmount;
    //           // sendNotification(
    //           //   userData.fcm_token,
    //           //   "PLAY WIN - Hurray!",
    //           //   "you won Rs " +
    //           //     winAmount +
    //           //     " in " +
    //           //     hour +
    //           //     ":00 PM time slot"
    //           // );
    // await fetchNotifications(mobile);
    // await addNotification(
    //   mobile,
    //   `PLAY WIN - you won Rs ${winAmount} in ${hour}:00 PM slot`,
    //   formattedDate,
    //   hour,
    //   "game"
    // );
    //           amountSpent += winAmount;

    //           console.log(newAmount);
    //           await update(userRef, { walletBalance: newAmount , wonCashAmount :  });
    //           console.log(`Increased amount for player `);
    //         } else {
    //           console.log(`User data not found for player`);
    //         }
    //       }
    //     }
    //   }
    // }

    for (const player of Object.values(gameData)) {
      const mobile = player.mobile;
      console.log(mobile);
      if (player.selectedCards) {
        for (const cardData of player.selectedCards) {
          console.log(cardData);
          console.log(cardData.amount);
          if (cardData.cardId === leastSelectedCard) {
            let winAmount = cardData.amount * 2;
            console.log("================win amount ===============");
            console.log(winAmount);
            const userRef = ref(database, `username/${mobile}`);
            const userSnapshot = await get(userRef);
            const userData = userSnapshot.val();
            console.log(userData);
            if (userData) {
              const newAmount = userData.walletBalance + winAmount;

              // Prepare the new wonCashAmount entry
              const newEntry = {
                amount: winAmount,
                date: formattedDate,
                timeSlot: `${formattedDisplayHour}:00 PM`,
                title: `PLAY WIN - you won ₹ ${winAmount} in ${formattedDisplayHour}:00 PM slot`,
                type: "game1",
              };

              // Fetch existing wonCashAmount list or initialize a new one
              let wonCashAmountList = userData.wonCashAmount || [];

              // Add the new entry to the list
              wonCashAmountList.push(newEntry);

              // sendNotification(
              //   userData.fcm_token,
              //   "PLAY WIN - Hurray!",
              //   "you won Rs " +
              //     winAmount +
              //     " in " +
              //     formattedDisplayHour +
              //     ":00 PM time slot"
              // );
              // await fetchNotifications(mobile);
              // await addNotification(
              //   mobile,
              //   `PLAY WIN - you won Rs ${winAmount} in ${formattedDisplayHour}:00 PM slot`,
              //   formattedDate,
              //   formattedDisplayHour,
              //   "game1"
              // );

              amountSpent += winAmount;

              console.log(newAmount);
              await update(userRef, {
                walletBalance: newAmount,
                wonCashAmount: wonCashAmountList,
              });
              console.log(
                `Increased amount for player and updated wonCashAmount list`
              );
            } else {
              console.log(`User data not found for player`);
            }
          }
        }
      }
    }

    let leftAmount = totalAmount - amountSpent;

    // Store the result in Firebase
    const resultRef = ref(
      database,
      `result_game1/${formattedDate}_${formattedHour}`
    );
    await set(resultRef, {
      cardWon: leastSelectedCard,
      totalGameCollection: totalAmount,
      amountToSpent: amountSpent,
      amountLeft: leftAmount,
    });

    console.log("Least selected card:", leastSelectedCard);
    return {
      cardWon: leastSelectedCard,
      totalGameCollection: totalAmount,
      amountToSpent: amountSpent,
      amountLeft: leftAmount,
    };
  } catch (error) {
    console.error("Error fetching game data:", error);
    return null;
  }
}

// Schedule the function to run every hour at the 3rd minute
// schedule.scheduleJob('3 * * * *', fetchAndProcessData);

// Manual trigger endpoint
app.get("/trigger", async (req, res) => {
  try {
    const result = await fetchAndProcessData();
    if (result) {
      res.send({
        cardWon: result.cardWon,
        totalGameCollection: result.totalGameCollection,
        amountToSpent: result.amountToSpent,
        amountLeft: result.amountLeft,
      });
    } else {
      res.send("No game data found or an error occurred during processing.");
    }
  } catch (error) {
    console.error("Error triggering data fetch and process:", error);
    res.status(500).send("Error triggering data fetch and process.");
  }
});

app.get("/", (req, res) => {
  res.send("Firebase Express Server");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
