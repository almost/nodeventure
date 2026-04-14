room("broom cupboard", {
  description: "It's dusty and dark, but relaxingly quiet.",
  exits: {
    west: "home2"
  }
});

item("home", "map", {
    description: "A magical map. It smarkles with magic",
    short: 'map',
    respwnTime: 3600,
});
const max_w = 20;
const max_h = 10;

const getIndex = function(x,y){
    return x+max_w*y;
}

const iterateMap = function(parent,exitName,room,game,ttl,mapArr,data,rooms,roomNum){
    if(ttl<0){
        return;
    }
    if(data.y>=max_h || data.y<0){
        return;
    }
    if(data.x>=max_w || data.x<0){
        return;
    }
    if(roomNum>9){
        return;
    }
    console.log(`next room: ${room} ${ttl} x=${data.x} y=${data.y} n=${roomNum}`);
    
    
    var exits = room && room.exits;
    var order = [[0,1,'|'],[1,0,'-'],[-1,0,'-'],[0,-1,'|']]; //,[1,1,'/'],[-1,1,'\\'],[-1,-1,'/'
    var i = -1;
    var orderIndex;
    var step1, step2;
        do{
            i++;
            orderIndex = (i+data.d)%order.length;
            if(i>=order.length){
                game.warn('no directions left');
                return;
            }
            step1 = {x:data.x+order[orderIndex][0],y:data.y+order[orderIndex][1]};
            step2 = {x:data.x+2*order[orderIndex][0],y:data.y+2*order[orderIndex][1]};
        } while( mapArr[getIndex(step1.x,step1.y)]!=null || mapArr[getIndex(step2.x,step2.y)]!=null );
    if(parent!=null){
        mapArr[getIndex(step1.x,step1.y)] = order[orderIndex][2];
    }
    mapArr[getIndex(step2.x,step2.y)] = room ? roomNum.toString() : 'x';
    data.x = step2.x;
    data.y = step2.y;
    data.d = orderIndex;
        
    if(ttl==0){
        return room && room.id;
    }
    for(var n in exits){
        var roomName = room.exits[n];
        if(roomName == parent){
            continue;
        }
        var nextRoom = game.rooms[roomName];
        var nextRoomData = Object.create(data);
        if(!nextRoom){
            rooms.push(iterateMap.bind(null,room.id,n,null,game,ttl-1,mapArr,nextRoomData,rooms));
            //game.warn(`room ${room.exits[n]} not found. ${ttl}`);
        }else {
            rooms.push(iterateMap.bind(null,room.id,n,nextRoom,game,ttl-1,mapArr,nextRoomData,rooms));
        }
    }
    return room && `${room.id} (${exitName})`;
};

const readMap = function(rest,player,item,game){
    var room = player.getCurrentRoom();
    var w = 20;
    var h = 10;
    var mapArr = new Array(w*h);
    player.write("you read the map");
    
    roomQueue = [];
    roomNum = 0;
    roomKeys = [];
    roomQueue.push( iterateMap.bind(null,null,'you are here',room,game,4,mapArr,{x:10,y:3,d:0},roomQueue,roomNum) );
    while(roomQueue.length>0){
        var roomName = roomQueue.shift()(roomNum);
        if(roomName){
            roomKeys.push(`${roomNum}. ${roomName}`);
            roomNum++;
        }
    }
    
    
    var line = "";
    for(var j=0;j<10;j++){
        for(var i=0;i<20;i++){
            var c = mapArr[getIndex(i,j,w)];
            if( c ){
                line+=c;
            }
            else
                line+=' ';
        }
        line +='\n';
        
    }
    player.write(line);

    player.write(roomKeys.join('\n'));

};


itemCommand("read", "map", "peer at the map", readMap);
itemCommand("use", "map", "peer at the map", readMap);

