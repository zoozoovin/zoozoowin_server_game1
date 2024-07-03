const express = require("express");
const schedule = require("node-schedule");
const database = require("./firebase");
const { ref, get, set, update } = require("firebase/database");

const app = express();
const PORT = process.env.PORT || 3000;

// Function to fetch and process data
async function fetchAndProcessData() {
  // Fetch the current GMT time
  const now = new Date();
  
  // Convert GMT time to IST (GMT + 5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime());

  const formattedDate = `${istTime.getDate().toString().padStart(2, "0")}-${(
    istTime.getMonth() + 1
  ).toString().padStart(2, "0")}-${istTime.getFullYear()}`;
  let hour = istTime.getHours();

  const period = hour >= 12 ? "PM" : "AM";
  let displayHour = hour % 12 || 12; // Converts 0 to 12 for 12-hour format
  const formattedDisplayHour = displayHour.toString().padStart(2, "0"); // Ensures two-digit hour

  const formattedHour = `${formattedDisplayHour}:00 ${period}`;

  const refPath = `Game1/${formattedDate}_${formattedHour}`;
// const refPath = 'Game1/28-06-2024_06:00 PM';

  console.log(refPath);
  const dataRef = ref(database, refPath);

  try {
    const snapshot = await get(dataRef);
    const gameData = snapshot.val();
    console.log("===============GAME DATA=================");
    console.log(gameData);
  
    if (!gameData) {
      console.log("No game data found.");
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
  
      
  
      // Check if the least selected card is present for any player
  
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
                console.log(newAmount);
                await update(userRef, { walletBalance: newAmount });
                console.log(`Increased amount for player `);
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
      // return leastSelectedCard;
    } catch (error) {
      console.error("Error fetching game data:", error);
      return null;
    }
  }
  
  // Schedule the function to run every hour at the 3rd minute
  schedule.scheduleJob('3 * * * *', fetchAndProcessData);
  
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
  