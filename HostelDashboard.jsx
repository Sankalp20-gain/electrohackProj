import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { Link, useParams, useNavigate } from "react-router-dom";
import { app, db } from "../utils/firebase";
import CountdownTimer from "./CountDownTimer";
import { getAuth } from "firebase/auth";

export default function HostelDashboard() {
  const { hostelId } = useParams();
  const hostelName = hostelId.replace("-", " ").toUpperCase();
  const navigate = useNavigate();

  const [activeGroupOrders, setActiveGroupOrders] = useState(0);
  const [orders, setOrders] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [orderName, setOrderName] = useState("");
  const [timeLimit, setTimeLimit] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [creatorInfo, setCreatorInfo] = useState(null);
  const [showCreatorModal, setShowCreatorModal] = useState(false);

  // Listen to order updates in real time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "orders"), (snapshot) => {
      const fetchedOrders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setOrders(fetchedOrders);
    });
    return () => unsub();
  }, []);

  // Create a new order
  const handleCreateOrder = async () => {
    const minutes = parseInt(timeLimit, 10);
    if (!orderName.trim() || isNaN(minutes) || minutes <= 0) {
      alert("Please enter a valid order name and time limit (minutes).");
      return;
    }

    const auth = getAuth(app);
    const user = auth.currentUser;

    await addDoc(collection(db, "orders"), {
      name: orderName.trim(),
      items: Math.floor(Math.random() * 10) + 1,
      status: "Pending",
      timeLimit: minutes,
      createdAt: serverTimestamp(),
      createdById: user?.uid,
      createdByName: user?.displayName || "Anonymous",
      hostelId: hostelId
    });

    setShowModal(false);
    setOrderName("");
    setTimeLimit("");
    alert("Order created successfully.");
    navigate(`/dashboard/${hostelId}`);
  };

  // Fetch details of the order creator
  const handleViewCreator = async (creatorId) => {
    if (!creatorId) return alert("Creator ID not found.");

    try {
      const userRef = doc(db, "users", creatorId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setCreatorInfo(userSnap.data());
        setShowCreatorModal(true);
      } else {
        alert("Creator details not found.");
      }
    } catch (error) {
      console.error("Error fetching creator details:", error);
    }
  };

  // Filter orders by hostel
  useEffect(() => {
    if (!hostelId) return;

    const q = query(collection(db, "orders"), where("hostelId", "==", hostelId));

    const unsub = onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setOrders(fetchedOrders);
    });

    return () => unsub();
  }, [hostelId]);

  return (
    <div className={`${darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"} min-h-screen p-6`}>
      {/* Navbar */}
      <div className={`flex items-center justify-between mb-6 ${darkMode ? "bg-gray-800" : "bg-white"} bg-opacity-90 backdrop-blur-md p-4 rounded-xl shadow-md`}>
        <h1 className="text-3xl font-bold text-green-600">Group Order</h1>
        <div className="flex gap-4">
          <Link to="/dashboard" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition">Back</Link>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-medium transition"
          >
            {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </div>

      {/* Hostel Info */}
      <div className={`${darkMode ? "bg-gray-800" : "bg-white"} shadow-md rounded-2xl p-6 mb-4`}>
        <h2 className="text-2xl font-semibold mb-2">{hostelName}</h2>
        <p className={`${darkMode ? "text-gray-300" : "text-gray-600"}`}>
          Active group order rooms: {activeGroupOrders}
        </p>
      </div>

      {/* Create Order Button */}
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-white font-semibold rounded-xl shadow-md transition"
        >
          + Create New Group Order
        </button>
      </div>

      {/* Orders List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {orders
          .filter((order) => order.status === "Pending")
          .map((order) => {
            const createdAtMs = order.createdAt?.toMillis ? order.createdAt.toMillis() : order.createdAt;
            const elapsedSeconds = (Date.now() - createdAtMs) / 1000;
            const remainingSeconds = Math.max(0, order.timeLimit * 60 - elapsedSeconds);

            return (
              <div
                key={order.id}
                className={`${darkMode ? "bg-gray-800" : "bg-white"} shadow-md rounded-2xl p-6 hover:shadow-xl transition transform hover:scale-105`}
              >
                <h3 className="text-lg font-semibold mb-2">Order #{order.id}</h3>
                <p className="mb-1">Placed by: {order.name}</p>
                <p className={`mb-1 font-medium ${remainingSeconds / 60 <= 5 ? "text-red-600" : "text-gray-700"}`}>
                  Time left: <CountdownTimer initialSeconds={remainingSeconds} />
                </p>
                <p className={`mb-2 font-medium ${order.status === "Completed" ? "text-green-600" : "text-yellow-600"}`}>
                  Status: {order.status}
                </p>
                <Link
                  to={`/dashboard/${hostelId}/order/${order.id}`}
                  className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition"
                >
                  View Details
                </Link>
                <button
                  onClick={() => handleViewCreator(order.createdById)}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition ml-2"
                >
                  View Creator
                </button>
              </div>
            );
          })}
      </div>

      {/* Create Order Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className={`${darkMode ? "bg-gray-800 text-white" : "bg-white text-black"} p-6 rounded-xl shadow-lg w-96`}>
            <h2 className="text-xl font-semibold mb-4">Create New Order</h2>
            <input
              type="text"
              placeholder="Enter Order Name"
              value={orderName}
              onChange={(e) => setOrderName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg mb-3 text-black"
            />
            <input
              type="number"
              placeholder="Enter Time Limit (minutes)"
              value={timeLimit}
              onChange={(e) => setTimeLimit(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg mb-3 text-black"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg">
                Cancel
              </button>
              <button onClick={handleCreateOrder} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Creator Info Modal */}
      {showCreatorModal && creatorInfo && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className={`${darkMode ? "bg-gray-800 text-white" : "bg-white text-black"} p-6 rounded-xl shadow-lg w-96`}>
            <h2 className="text-xl font-semibold mb-4">Creator Details</h2>
            <p><strong>Name:</strong> {creatorInfo.name}</p>
            <p><strong>Mobile:</strong> {creatorInfo.mobile}</p>
            <p><strong>Roll Number:</strong> {creatorInfo.rollNumber}</p>
            <p><strong>Room Number:</strong> {creatorInfo.roomNumber}</p>
            <p><strong>Hostel:</strong> {creatorInfo.hostel}</p>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowCreatorModal(false)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
