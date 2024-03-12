document.addEventListener("DOMContentLoaded", (event) => {
    const socket = io(window.location.hostname, {
      query: 'notificationKey=NOTIFICATION_KEY'
    });
  
    socket.on('NEW_NOTIFICATION', (notification) => {
      console.log(notification);
    });
  
    socket.emit('join', 'SOME_CHANNEL');
  });
  