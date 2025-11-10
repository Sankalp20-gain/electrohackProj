import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { auth, db } from "../utils/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  query,
  orderBy,
} from "firebase/firestore";

export default function OrderDetails() {
  const { orderId } = useParams();
  const [participants, setParticipants] = useState([]);
  const [newParticipant, setNewParticipant] = useState({
    name: "",
    room: "",
    uid: "",
  });
  const [newItem, setNewItem] = useState({ name: "", quantity: "", price: "" });
  const [expandedParticipant, setExpandedParticipant] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef(null);

  // map of userId -> display name
  const [userNames, setUserNames] = useState({});

  const itemUnsubsRef = useRef(new Map()); // track per-participant item listeners
  const unsubMessagesRef = useRef(null);

  // helper for current user info
  const currentUser = auth.currentUser;
  const senderId = currentUser?.uid || null;
  const senderName =
    currentUser?.displayName ||
    (currentUser?.phoneNumber ? currentUser.phoneNumber : "Anonymous");

  // Fetch participants + per-participant items in real time
  useEffect(() => {
    if (!orderId) return;

    const unsubParticipants = onSnapshot(
      collection(db, "orders", orderId, "participants"),
      (snapshot) => {
        const baseParticipants = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
          items: [],
          total: 0,
        }));

        setParticipants(baseParticipants);

        const currentIds = new Set(snapshot.docs.map((d) => d.id));

        snapshot.docs.forEach((docSnap) => {
          const pid = docSnap.id;
          if (!itemUnsubsRef.current.has(pid)) {
            const itemsRef = collection(
              db,
              "orders",
              orderId,
              "participants",
              pid,
              "items"
            );

            const unsubItems = onSnapshot(itemsRef, (itemsSnap) => {
              const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
              const total = items.reduce(
                (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
                0
              );

              setParticipants((prev) =>
                prev.map((p) => (p.id === pid ? { ...p, items, total } : p))
              );
            });

            itemUnsubsRef.current.set(pid, unsubItems);
          }
        });

        // cleanup listeners for removed participants
        Array.from(itemUnsubsRef.current.keys()).forEach((pid) => {
          if (!currentIds.has(pid)) {
            const unsub = itemUnsubsRef.current.get(pid);
            unsub && unsub();
            itemUnsubsRef.current.delete(pid);
          }
        });
      }
    );

    return () => {
      unsubParticipants();
      itemUnsubsRef.current.forEach((u) => u && u());
      itemUnsubsRef.current.clear();
    };
  }, [orderId]);

  // Messages realtime listener
  useEffect(() => {
    if (!orderId) return;

    const messagesRef = query(
      collection(db, "orders", orderId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(messagesRef, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
    });

    unsubMessagesRef.current = unsub;

    return () => {
      unsub && unsub();
      unsubMessagesRef.current = null;
    };
  }, [orderId]);

  // fetch display names for message senders when messages update
  useEffect(() => {
    const ids = Array.from(new Set(messages.map((m) => m.senderId).filter(Boolean)));
    const toFetch = ids.filter((id) => !userNames[id]);

    if (toFetch.length === 0) return;

    let cancelled = false;
    (async () => {
      const newNames = {};
      await Promise.all(
        toFetch.map(async (id) => {
          try {
            const snap = await getDoc(doc(db, "users", id));
            if (snap.exists()) {
              const data = snap.data();
              newNames[id] = data.name || data.displayName || null;
            } else {
              const msg = messages.find((m) => m.senderId === id);
              newNames[id] = msg?.senderName || null;
            }
          } catch {
            const msg = messages.find((m) => m.senderId === id);
            newNames[id] = msg?.senderName || null;
          }
        })
      );
      if (!cancelled) {
        setUserNames((prev) => ({ ...prev, ...newNames }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, userNames]);

  // Auto-scroll chat to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  // Add participant
  const addParticipant = async () => {
    const { name, room } = newParticipant;
    if (!name || !room) return alert("Please fill all fields");

    const user = auth.currentUser;

    await addDoc(collection(db, "orders", orderId, "participants"), {
      name,
      room,
      createdAt: serverTimestamp(),
      creatorId: user?.uid || null,
    });

    setNewParticipant({ name: "", room: "", uid: "" });
  };

  // Add item
  const addItem = async (participantId) => {
    const { name, quantity, price } = newItem;

    if (!name || !quantity || !price) {
      alert("Please fill all fields");
      return;
    }

    await addDoc(
      collection(db, "orders", orderId, "participants", participantId, "items"),
      {
        name,
        quantity: Number(quantity),
        price: Number(price),
        createdAt: serverTimestamp(),
      }
    );

    setNewItem({ name: "", quantity: "", price: "" });
  };

  // View participant details (from users collection)
  const handleViewParticipant = async (participant) => {
    if (!participant?.creatorId) return alert("No creator ID found");

    try {
      const userRef = doc(db, "users", participant.creatorId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setSelectedParticipant(userSnap.data());
        setShowPopup(true);
      } else {
        alert("User not found in Firestore");
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  // Send chat message
  const sendMessage = async (e) => {
    e && e.preventDefault();
    const text = messageText.trim();
    if (!text) return;
    try {
      await addDoc(collection(db, "orders", orderId, "messages"), {
        text,
        senderId,
        senderName,
        createdAt: serverTimestamp(),
      });
      setMessageText("");
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  // Order-level calculations
  const orderSubtotal = participants.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
  const orderDeliveryFee = orderSubtotal > 200 ? 0 : 20; // change 20 as desired
  const orderGrandTotal = orderSubtotal + orderDeliveryFee;

  // small helper to format timestamp (createdAt may be null for recent writes until serverTimestamp resolves)
  const formatTime = (ts) => {
    try {
      if (!ts) return "";
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-3xl font-extrabold mb-6 text-black">
        Order Details
        <span className="ml-4 inline-block w-14 h-2 rounded bg-gradient-to-r from-emerald-400 to-yellow-400 align-middle" />
      </h2>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: participants + summary */}
        <div className="flex-1 space-y-4">
          {/* Add Participant */}
          <div className="bg-white p-5 rounded-2xl shadow-lg border border-emerald-50">
            <h3 className="text-lg font-semibold mb-3 text-emerald-800">Add Participant</h3>
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                placeholder="Name"
                value={newParticipant.name}
                onChange={(e) =>
                  setNewParticipant({ ...newParticipant, name: e.target.value })
                }
                className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <input
                type="text"
                placeholder="Room No"
                value={newParticipant.room}
                onChange={(e) =>
                  setNewParticipant({ ...newParticipant, room: e.target.value })
                }
                className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <button
                onClick={addParticipant}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-400 to-emerald-700 text-white font-semibold shadow-md hover:scale-[1.01] transition"
              >
                Add
              </button>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-4">
            {participants.map((p) => {
              const deliveryFee = p.total > 200 ? 0 : 20; // per-participant delivery logic
              const grand = (Number(p.total) || 0) + deliveryFee;

              return (
                <div
                  key={p.id}
                  className="bg-white p-5 rounded-2xl shadow-md hover:shadow-xl transition border border-emerald-50"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-black text-lg">{p.name}</h4>
                      <p className="text-sm text-gray-500">Room {p.room}</p>
                      <p className="text-sm text-gray-700">Subtotal: ₹{p.total}</p>
                      <p className="text-sm text-gray-700">Delivery: ₹{deliveryFee}</p>
                      <p className="text-sm text-gray-700 font-semibold">Grand Total: ₹{grand}</p>
                    </div>

                    <div className="flex items-center">
                      <button
                        onClick={() =>
                          setExpandedParticipant(
                            expandedParticipant === p.id ? null : p.id
                          )
                        }
                        className="text-emerald-600 text-sm underline mr-3"
                      >
                        {expandedParticipant === p.id ? "Hide" : "View Items"}
                      </button>

                      <button
                        onClick={() => handleViewParticipant(p)}
                        className="text-yellow-600 text-sm underline"
                      >
                        View Details
                      </button>
                    </div>
                  </div>

                  {/* Items */}
                  {expandedParticipant === p.id && (
                    <div className="mt-4">
                      <ul className="space-y-2">
                        {p.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex justify-between p-3 border rounded-lg bg-gray-50"
                          >
                            <span className="text-gray-800">
                              {item.name} × {item.quantity}
                            </span>
                            <span className="text-gray-800">₹{Number(item.price) * Number(item.quantity)}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Add Item */}
                      <div className="flex flex-col md:flex-row gap-2 mt-3">
                        <input
                          type="text"
                          placeholder="Item name"
                          value={newItem.name}
                          onChange={(e) =>
                            setNewItem({ ...newItem, name: e.target.value })
                          }
                          className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          value={newItem.quantity}
                          onChange={(e) =>
                            setNewItem({ ...newItem, quantity: e.target.value })
                          }
                          className="w-24 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                        <input
                          type="number"
                          placeholder="Price"
                          value={newItem.price}
                          onChange={(e) =>
                            setNewItem({ ...newItem, price: e.target.value })
                          }
                          className="w-28 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                        <button
                          onClick={() => addItem(p.id)}
                          className="bg-gradient-to-r from-emerald-400 to-emerald-700 text-white px-4 py-2 rounded-lg hover:scale-[1.01] transition"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Order Summary */}
          <div className="bg-white p-5 rounded-2xl shadow-lg mt-2 border border-emerald-50">
            <h3 className="text-lg font-semibold mb-3 text-emerald-800">Order Summary</h3>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Order Subtotal</span>
              <span className="font-medium text-gray-800">₹{orderSubtotal}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Order Delivery</span>
              <span className="font-medium text-gray-800">₹{orderDeliveryFee}</span>
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t">
              <span className="text-gray-800 font-semibold">Order Total</span>
              <span className="text-gray-800 font-semibold">₹{orderGrandTotal}</span>
            </div>
          </div>
        </div>

        {/* Right: Chat */}
        <div className="w-full lg:w-96 bg-white rounded-2xl shadow-lg flex flex-col border border-emerald-50">
          <div className="p-4 border-b bg-gradient-to-r from-emerald-50 to-yellow-50 rounded-t-2xl">
            <h3 className="font-semibold text-emerald-800">Group Chat</h3>
            <p className="text-sm text-gray-500">Everyone in this order can chat</p>
          </div>

          <div className="p-4 flex-1 overflow-auto space-y-3">
            {messages.map((m) => {
              const mine = m.senderId === senderId;
              const displayName =
                userNames[m.senderId] || m.senderName || (m.senderId === senderId ? senderName : "Anonymous");

              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-xl ${mine ? "bg-emerald-600 text-white" : "bg-yellow-50 text-gray-800"} shadow-sm`}
                  >
                    <div className="text-xs mb-1">
                      <strong className="text-black">{displayName}</strong>
                    </div>
                    <div className="whitespace-pre-wrap">{m.text}</div>
                    <div className="text-xs text-gray-400 mt-1 text-right">
                      {formatTime(m.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={sendMessage}
            className="p-3 border-t flex gap-2 items-center rounded-b-2xl"
          >
            <input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Write a message..."
              className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            <button
              type="submit"
              disabled={!messageText.trim()}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-400 to-emerald-700 text-white disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Popup Modal */}
      {showPopup && selectedParticipant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-80 border border-emerald-50">
            <h3 className="text-lg font-bold mb-4 text-black">Participant Details</h3>
            <p className="text-gray-800"><strong>Name:</strong> {selectedParticipant.name}</p>
            <p className="text-gray-800"><strong>Phone:</strong> {selectedParticipant.phone}</p>
            <p className="text-gray-800"><strong>Roll No:</strong> {selectedParticipant.roll}</p>
            <p className="text-gray-800"><strong>Room:</strong> {selectedParticipant.room}</p>
            <p className="text-gray-800"><strong>Hostel:</strong> {selectedParticipant.hostel}</p>
            <button
              onClick={() => setShowPopup(false)}
              className="mt-4 bg-red-500 text-white w-full py-2 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
