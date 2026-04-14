const surface = `
....*
.*...
....R
.R*..
...*.
`.trim().split("\n").map(line => line.split(""));

function outdent(strings) {
    return strings.join(" ").trim().replace(/[ \n\t\r]+/g, " ");
}

function roomId(i, j) {
    const w = surface[0].length;
    const h = surface.length;
    
    while (i < 0) i += w;
    while (i >= w) i -= w;
    while (j < 0) j += h;
    while (j >= h) j -= h;
    
    return `moon_${i}_${j}`;
}

function parseRoomId(id) {
    const [, x, y] = id.match(/^room_([0-9]+)_([0-9]+)$/);
    return [parseInt(x, 10), parseInt(y, 10)]
}

function createDust(i, j) {
    room(roomId(i, j), {
        description: outdent`
            You are stuck on the moon. 
            The dusty expanse stretches on in all directions.
        `,
        exits: {
            north: roomId(i, j - 1),
            south: roomId(i, j + 1),
            east: roomId(i + 1, j),
            west: roomId(i - 1, j),
        }
    })
}

function createRock(i, j) {
    item(roomId(i, j), `moonrock`, {
        respawnTime: 10,
        short: "a rock",
        description: "A shiny moon rock. Might be made of cheese.",
    })
}

let roverNum = 0;

function createRover(i, j) {
    const num = roverNum++;
    
    const rover = character(`rover${num}`, {
        location: roomId(i, j),
        description: `a festidious moon rover (serial number MOON-${num})`
    })
    
    handler("tick", () => {
        if(Math.random() > 0.25) {
            return;
        }
        
        const room = rover.getCurrentRoom();
        const rock = room.items.find(item => item.name === "moonrock");
        
        const exec = (cmd) => {
            // console.log(`rover ${num}: ${cmd}`);
            rover.execute(cmd);
        }
        
        if(rock != null) {
            exec("say om nom moon rocks");
            exec("get moonrock");
        } else {
            const exits = Object.keys(room.exits);
            const exit = exits[Math.floor(Math.random() * exits.length)];

            exec("say no moon rocks here... i think i'll head " + exit)            
            exec("go " + exit);
        }
    })
}

for (let j = 0; j < surface.length; j++) {
    const line = surface[j];
    
    for (let i = 0; i < line.length; i++) {
        const cell = line[i];
    
        switch (cell) {
            case "*":
                createRock(i, j);
            case "R":
                createRover(i, j);
            default: 
                createDust(i, j);
        }
    }
}
