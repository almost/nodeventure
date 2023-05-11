
const bartender = character("bartender", {
    location: "The Hop Poles",
    description: ""
});

handler("playerTalk", (player, message) => {
    if (player.getCurrentRoom() === bartender.getCurrentRoom() && player !== bartender) {
        ///the skiff/i.exec(message)
        if( (message.indexOf('bartender ')) !== 0 ){
            return;
        }
        var results = /pour me a (.+)/i.exec(message);
        if(results.length!=2){
            return;
        }
        player.getCurrentRoom().broadcast(`The Bartender pours you a ${results[1]}`);
        //bartender.execute("");
    }
});

