
const bartender = character("bartender", {
    location: "The Hop Poles",
    description: ""
});

handler("playerTalk", (player, message) => {
    if (player.getCurrentRoom() === bartender.getCurrentRoom() && player !== bartender) {
        let validDrinks = ['beer','whiskey','cider'];

        ///the skiff/i.exec(message)
        if( (message.indexOf('bartender ')) !== 0 ){
            return;
        }
        if(/bartender what do you have/i.exec(message)){
            bartender.execute(`say I have ${validDrinks.join(',')}`);

        }
        var results = /pour me a (?:(pint|half|shot) of )?(.+)/i.exec(message);
        console.log(results);
        if(results.length!=3){
            return;
        }
        let currentRoom = player.getCurrentRoom();
        let multiplier = {
            'pint':1,
            'half':0.5,
            'shot':0.1
        }[results[1]];
        let priceList = [2.5,30,2.5];
        
        var index = validDrinks.indexOf(results[2]);
        console.log(index);
        console.log(results[2]*multiplier);
        if(index==-1){
            bartender.execute(`say I don't know how to make a ${results[2]}`);
            return;
        }

        var drink = validDrinks[index];
        var price = priceList[index]*multiplier;
        
        currentRoom.broadcast(`The Bartender pours you a ${drink}`);
        
        item(currentRoom,drink,{
            description: `A delicious refreshing ${drink}`,
            short: 'drink',
            respawnTime: 3600,
        });        
        bartender.execute(`say That will be £${price}`);
    }
});

