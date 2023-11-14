const Alpaca = require("@alpacahq/alpaca-trade-api");
const alpaca = new Alpaca(); // Environment Variables
const WebSocket = require('ws');

// Server < -- > Data Source 
// Communication can go both ways
// Data source can send us information
// Send data to the data source (Authenticate, ask what data we want)

// WebSockets are like push notifications on your phone
// Whenever an event happens you get a notification

// Get our account information.
alpaca.getAccount().then((account) => {
    // Check if our account is restricted from trading.
    if (account.trading_blocked) {
      console.log("Account is currently restricted from trading.");
    }
  
    // Check how much money we can use to open new positions.
    console.log(`$${account.buying_power} is available as buying power.`);
  });

  // Get account information.
alpaca.getAccount().then((account) => {
    // Calculate the difference between current balance and balance at the last market close.
    const balanceChange = account.equity - account.last_equity;
  
    console.log("Today's portfolio balance change:", balanceChange);
  });

 
  // Get account information and print it
// Fetch account information from Alpaca
alpaca.getAccount().then((account) => {
    console.log("Current Account:", account);
});

// Establish a WebSocket connection for news streaming
const wss = new WebSocket("wss://stream.data.alpaca.markets/v1beta1/news");

// Handle WebSocket events (e.g., onopen, onmessage, onerror, onclose) as needed
// For example:
wss.onopen = () => {
    console.log("WebSocket connection opened");
};

wss.onmessage = (event) => {
    console.log("Received WebSocket message:", event.data);
};

wss.onerror = (error) => {
    console.error("WebSocket error:", error);
};

wss.onclose = (event) => {
    console.log("WebSocket connection closed:", event);
};


wss.on('open', function() {
    console.log("Websocket connected!");

    // We now have to log in to the data source
    const authMsg = {
        action: 'auth',
        key: process.env.APCA_API_KEY_ID,
        secret: process.env.APCA_API_SECRET_KEY
    };

    wss.send(JSON.stringify(authMsg)); // Send auth data to ws, "log us in"

    // Subscribe to all news feeds
    const subscribeMsg = {
        action: 'subscribe',
        news: ['*'] // ["TSLA"]
    };
    wss.send(JSON.stringify(subscribeMsg)); // Connecting us to the live data source of news
});

wss.on('message', async function(message) {
    console.log("Message is " + message);

    // message is a STRING
    const currentEvent = JSON.parse(message)[0];
    
    // "T": "n" newsEvent
    if(currentEvent.T === "n") { // This is a news event
        let companyImpact = 0;
       

        // Ask ChatGPT its thoughts on the headline
        const apiRequestBody = {
            "model": "gpt-4",
            "messages": [
                { role: "system", content: "Leveraging your financial background and extensive experience in stock recommendations, you are well-equipped to evaluate and estimate the potential impact of stock news on a company. Provide a numerical response between 1 and 100 to specify the impact of the given headline." },
                { role: "user", content: `Considering the headline '${currentEvent.headline}', provide a numerical response on a scale from 1 to 100, detailing the impact of this headline.` }
            ]
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(apiRequestBody)


        }).then((data) => {
            return data.json();
        }).then((data) => {
            // data is the ChatGPT response
            console.log(data);
            console.log(data.choices[0].message);
            companyImpact = parseInt(data.choices[0].message.content);
        });

        // Make trades based on the output (of the impact saved in companyImpact)
        const tickerSymbol = currentEvent.symbols[0];

        // 1 - 100, 1 being the most negative, 100 being the most positive impact on a company.
        if(companyImpact >= 72) { // if score >= 80 : BUY STOCK
            // Buy stock
          const  order = await alpaca.createOrder({
                symbol: tickerSymbol,
                qty: 1,
                side: 'buy',
                type: 'market',
                time_in_force: 'day' // day ends, it wont trade.
            });
        } else if (companyImpact <= 40) { // else if impact <= 30: SELL ALL OF STOCK
            // Sell stock
            const closedPosition = await alpaca.closePosition(tickerSymbol); //(tickerSymbol);

            const options = {method: 'DELETE', headers: {accept: 'application/json'}};

            fetch('https://paper-api.alpaca.markets/v2/positions', options)
              .then(response => response.json())
              .then(response => console.log(response))
              .catch(err => console.error(err));

        }
        
    }
});
