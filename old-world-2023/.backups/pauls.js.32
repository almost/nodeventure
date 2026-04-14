room("broom cupboard", {
  description: "It's dusty and dark, but relaxingly quiet.",
  exits: {
    west: "home2"
  }
});

item("broom cupboard", "map", {
    description: "A magical map. It smarkles with magic",
    short: 'map',
    respwnTime: 3600,
});


const getIndex = function(x,y,w){
    return x+w*y;
}

const recurseMap = function(room,game,ttl,mapArr,x,y){
    if(ttl<0){
        return;
    }
    var exits = room.exits;
    var order = [[0,1],[1,0],[-1,0],[0,-1]];
    var i = 0;
    for(var n in exits){
        var newX = x+order[i][0];
        var newY = y+order[i][1];
        while( mapArr[getIndex(newX,newY,20)]!=null ){
            i++;
            if(i>=4){
                return;
            }

        }
        recurseMap(game.rooms[room.exits[n]],game,ttl-1,mapArr,newX,newY);
    }
};

const readMap = function(rest,player,item,game){
    var room = player.getCurrentRoom();
    var w = 20;
    var h = 10;
    var mapArr = new Array(w*h);
    player.write("you read the map");
    
    recurseMap(room,game,10,mapArr,5,5);
    
    for(var j=0;j<10;j++){
        var line = "";
        for(var i=0;i<20;i++){
            line+=' ';
        }
        
        player.write(line);
    }
};


itemCommand("read", "map", "peer at the map", readMap);
itemCommand("use", "map", "peer at the map", readMap);

