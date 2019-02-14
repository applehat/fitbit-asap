import { localStorage } from "local-storage";
import { peerSocket } from "messaging"

const debug = false

const get_queue = () => {
  try {
    const queue = JSON.parse(localStorage.getItem("_asap_queue"))
    if (Array.isArray(queue)) {
      return queue
    } else {
      return []
    }
  } catch (error) {
	asap.debug && console.log(error)
    return []
  }
}

const enqueue = (data) => {
  asap.debug && console.log("Enqueue Message ID #" + data._asap_id)
  // Add the message to the queue
  const queue = get_queue()
  queue.push(data)
  // Write the queue to disk
  try {
    localStorage.setItem("_asap_queue", JSON.stringify(queue))
  } catch (error) {
    asap.debug && console.log(error)
  }
  // Attempt to send all data
  send_all()
}

const dequeue = (id) => {
  asap.debug && console.log("Dequeue Message ID #" + id)
  // Remove the message from the queue
  const queue = get_queue()
  for (let i in queue) {
    if (queue[i]._asap_id === id) {
      queue.splice(i)
      break
    }
  }
  // Write the queue to disk
  try {
    localStorage.setItem("_asap_queue", JSON.stringify(queue))
  } catch (error) {
    asap.debug && console.log(error)
  }
}

const send = (message, options) => {
  const now = Date.now()
  // Set default options
  options = options || {}
  options.timeout = options.timeout || 2592000000 // 30 days
  // Create the data object
  const data = {
    _asap_id: Math.floor(Math.random() * 10000000000), // Random 10-digit number
    _asap_created: now,
    _asap_expires: now + options.timeout,
    _asap_status: "sending",
    _asap_message: message
  }
  // Add the data to the queue
  enqueue(data)
}

const send_all = () => {
  const queue = get_queue()
  for (let data of queue) {
    try {
      peerSocket.send(data)
    } catch (error) {
      asap.debug && console.log(error)
    }
  }
}

// Attempt to send enqueued data after startup (the open event is unreliable during startup)
setTimeout(() => {
  send_all()
}, 1000)

// Attempt to send enqueued data when a connection opens after startup
peerSocket.addEventListener("open", () => {
  send_all()
})

peerSocket.addEventListener("message", event => {
  const data = event.data
  if (data._asap_id) {
    switch (data._asap_status) {
      case "sending":
        if (data._asap_id) {
          try {
            peerSocket.send({_asap_status: "received", _asap_id: data._asap_id})
            asap.onmessage(data._asap_message)
          } catch (error) {
            asap.debug && console.log(error)
          }
        }
        break
      case "received":
        dequeue(data._asap_id)
        break
    }
  }
})



const asap = {
  debug: false,
  setDebug: (bool) => {
    this.debug = bool;
  },
  send: send,
  onmessage: () => {}
}

export default asap
