import bodyParser from "body-parser";
import express from "express";
import { BASE_NODE_PORT } from "../config";
import { Value } from "../types";
import { delay } from "../utils";

export async function node(
  nodeId: number, // the ID of the node
  N: number, // total number of nodes in the network
  F: number, // number of faulty nodes in the network
  initialValue: Value, // initial value of the node
  isFaulty: boolean, // true if the node is faulty, false otherwise
  nodesAreReady: () => boolean, // used to know if all nodes are ready to receive requests
  setNodeIsReady: (index: number) => void // this should be called when the node is started and ready to receive requests
) {
  const node = express();
  node.use(express.json());
  node.use(bodyParser.json());

  let proposals: Map<number, Value[]> = new Map();
  let votes: Map<number, Value[]> = new Map();

  // TODO implement this
  // this route allows retrieving the current status of the node
  const state = {
    killed: false,
    x: initialValue,
    decided: false,
    k: 0
  };

  const handleStatusRequest = (req: any, res: any) => {
    if (isFaulty) {
      res.status(500).send("faulty");
    } else {
      res.status(200).send("live");
    }
  };

  node.get("/status", handleStatusRequest);


















  // TODO implement this
  // this route allows the node to receive messages from other nodes


  // Route to handle messages from other nodes
  node.post("/message", async (req, res) => {
    const { k, x, type } = req.body;

    if (!isFaulty && !state.killed) {
      if (type === "proposal") {
        handleProposal(k, x);
      } else if (type === "vote") {
        handleVote(k, x);
      }
    }

    res.status(200).send("Message received and processed.");
  });

  // Function to handle proposal messages
  function handleProposal(k: number, x: Value) {
    if (!proposals.has(k)) {
      proposals.set(k, []);
    }
    proposals.get(k)!.push(x);

    if (proposals.get(k)!.length >= (N - F)) {
      const consensus = calculateConsensus(proposals.get(k)!);

      for (let i = 0; i < N; i++) {
        sendMessage(i, { k, x: consensus, type: "vote" });
      }
    }
  }

  // Function to handle vote messages
  function handleVote(k: number, x: Value) {
    if (!votes.has(k)) {
      votes.set(k, []);
    }
    votes.get(k)!.push(x);

    if (votes.get(k)!.length >= (N - F)) {
      const consensus = calculateConsensus(votes.get(k)!);

      if (consensus !== null) {
        state.x = consensus;
        state.decided = true;
      } else {
        state.x = Math.random() > 0.5 ? 0 : 1;
        state.k = (state.k !== undefined) ? state.k + 1 : 0;

        for (let i = 0; i < N; i++) {
          sendMessage(i, { k: state.k, x: state.x, type: "proposal" });
        }
      }
    }
  }

  // Function to calculate consensus
  function calculateConsensus(values: Value[]): Value | null {
    const count0 = values.filter(el => el === 0).length;
    const count1 = values.filter(el => el === 1).length;

    if (count0 > (N / 2)) {
      return 0;
    } else if (count1 > (N / 2)) {
      return 1;
    } else {
      return null;
    }
  }

  // Function to send message to other nodes
  // Function to send message to other nodes, adjusted to return a promise
function sendMessage(nodeIndex: number, message: any) {
  return fetch(`http://localhost:${BASE_NODE_PORT + nodeIndex}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message)
  });
}






























  
  // TODO implement this
  // this route is used to start the consensus algorithm
  node.get("/start", async (req, res) => {
    while (!nodesAreReady()) {
      await delay(100); // Wait for all nodes to be ready
    }

    if (!isFaulty && !state.killed) {
      state.k = 1;
      state.x = initialValue;
      state.decided = false;

      // Inside your /start route
      for (let i = 0; i < N; i++) {
        sendMessage(i, {k: state.k, x: state.x, type: "proposal"})
          .then(response => console.log(`Message sent to node ${i} successfully.`))
          .catch(error => console.error(`Failed to send message to node ${i}:`, error));
      }

      res.send("Consensus initialization successful.");
    } else {
      state.killed = true;
      res.status(500).send("Node encountered an issue and cannot proceed.");
    }
  });





















  // TODO implement this
  // this route is used to stop the consensus algorithm
  node.get("/stop", async (req, res) => {
    state.killed = true;
    state.x = 0;
    state.decided = false;
    state.k = 0;
    res.send("The node is stopped.");
  });

  // TODO implement this
  // get the current state of a node
  node.get("/getState", (req, res) => {
    res.send(state); 
  });

  // start the server
  const server = node.listen(BASE_NODE_PORT + nodeId, async () => {
    console.log(
      `Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`
    );

    // the node is ready
    setNodeIsReady(nodeId);
  });

  return server;
}