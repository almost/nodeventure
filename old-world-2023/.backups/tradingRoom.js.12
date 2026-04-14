room("tradingFloor", {
    description: "the trading floor",
    exits : {west: "home"},
}).broadcast("Welcome to the trading room, please trade responsibly");

item("tradingFloor", "computer", {
    image: '/files/chair.jpg',
    description: "This is a computer",
    short: 'a computer to trade on',
    respwnTime: 120,
});

const generateTickers = (numberOfTickers) => {
    let tickers = [];
    for(var i = 0; i < numberOfTickers; i++) {
        let charOne = (Math.random() + 1).toString(36).substring(7);
        tickers.push(charOne);
    }
    return tickers; 
};


console.log(generateTickers(30));

