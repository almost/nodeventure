item("home", "redbutton", {
    description: "A big red button"
});

itemCommand("press", "redbutton", (rest, player, item, game) => {
    for (let i = 0; i < 100; i += 1) {
        player.display.eval("alert('LOOOOOL')")
    }
});