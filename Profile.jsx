import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../utils/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function Profile() {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const auth = getAuth();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);

                // Normalize phone number (remove +91 if present)
                let phoneNumber = currentUser.phoneNumber;
                if (phoneNumber?.startsWith("+91")) {
                    phoneNumber = phoneNumber.substring(3);
                }

                // Fetch Firestore user data where mobile == phoneNumber
                const q = query(collection(db, "users"), where("mobile", "==", phoneNumber));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const userDoc = querySnapshot.docs[0].data();
                    setUserData(userDoc);
                } else {
                    // fallback if not found
                    setUserData({
                        name: null,
                        email: currentUser.email || null,
                        phone: phoneNumber,
                    });
                }
            } else {
                setUser(null);
                setUserData(null);
            }
        });

        return () => unsubscribe();
    }, []);

    if (!user) return <p className="text-center mt-10">Not logged in</p>;
    if (!userData) return <p className="text-center mt-10">Loading profile...</p>;

    // ✅ Fix: use userData.name (not user.name)
    const firstLetter = (userData.name || userData.email || "U")[0].toUpperCase();

    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 bg-white shadow-xl rounded-2xl text-center">

                {/* Avatar with first letter */}
                <div className="w-24 h-24 mx-auto flex items-center justify-center rounded-full bg-gradient-to-r from-green-400 to-yellow-400 text-white text-4xl font-bold shadow-md mb-6">
                    {firstLetter}
                </div>

                {/* User Info */}
                <h2 className="text-2xl font-semibold text-gray-800">
                    {userData.name || "No Name"}
                </h2>
                <p className="text-gray-500 mb-4">{userData.email || user.email || "No Email"}</p>

                <div className="space-y-2 text-gray-700">
                    <p>Name: {userData.name || "N/A"}</p>
                    <p>Email: {userData.email || user.email || "N/A"}</p>
                    {userData.phone && <p>Phone: {userData.phone}</p>}
                    {userData.mobile && <p>Phone: {userData.mobile}</p>}
                    {userData.rollNumber && <p>Roll Number: {userData.rollNumber}</p>}
                    {userData.roomNumber && <p>Room: {userData.roomNumber}</p>}
                    {userData.hostel && <p>Hostel: {userData.hostel}</p>}
                </div>
            </div>
        </div>
    );
}

