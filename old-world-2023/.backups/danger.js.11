const exec = require('child_process').exec;

const showNotification = () => {
    const command = `osascript -e 'display notification "Jake was here."'`;
    
    exec(command, (error) => {
        if (error) {
            console.log(error.message);
        }
    });
};

command('danger', 'Only Tom should run this', showNotification);
