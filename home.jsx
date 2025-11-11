import { Link } from "react-router-dom";
import { useAuth } from "../Auth/AuthContext";
import { useEffect, useRef, useState } from "react";
import { auth, db } from "../utils/firebase";
import { addDoc, collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";

export default function Home() {
  const { user, Logout } = useAuth();
  const videoRef = useRef(null);
  const [showMenu, setShowMenu] = useState(false);
  const dropdownRef = useRef(null);
  const [initial, setInitial] = useState("?");

  // useEffect(() => {
  //   const videoElement = videoRef.current;

  //   // const handleScroll = () => {
  //   //   if (videoElement && videoElement.matches(":hover")) {
  //   //     window.open("https://blinkit.com", "_blank");
  //   //   }
  //   // };

  //   window.addEventListener("scroll", handleScroll);
  //   return () => window.removeEventListener("scroll", handleScroll);
  // }, []);

  // dropdown close if clicked outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

 useEffect(() => {
    const getUserInitial = async () => {
      if (!user) return;

      try {
        
        if (user.phoneNumber) {
          let phone = user.phoneNumber;
          if (phone.startsWith("+91")) phone = phone.substring(3);

          const q = query(collection(db, "users"), where("mobile", "==", phone));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            if (data.name) {
              setInitial(data.name.charAt(0).toUpperCase());
              return;
            }
          }
        }

      
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          if (data.name) {
            setInitial(data.name.charAt(0).toUpperCase());
            return;
          }
        }
 
        setInitial(
          user.displayName?.charAt(0).toUpperCase() ||
            user.email?.charAt(0).toUpperCase() ||
            "?"
        );
      } catch (err) {
        console.error("Error fetching user initial:", err);
        setInitial("?");
      }
    };

    getUserInitial();
  }, [user]);

  const handleLogout = async () => {
    await Logout();
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-12 py-5 bg-white shadow-md">
        <h1 className="text-4xl font-extrabold tracking-wide text-green-600">
          Group<span className="text-yellow-400">Order</span>
        </h1>

        <div className="flex items-center gap-10">
          <Link
            to="/dashboard"
            className="px-5 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 hover:shadow-md transition"
          >
            Dashboard
          </Link>
          <a
            href="https://blinkit.com"
            target="_blank"
            rel="noreferrer"
            className="px-5 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 hover:shadow-md transition"
          >
            Blinkit
          </a>

          {!user ? (
            <>
              <Link to="/login" className="hover:text-green-600">
                Login
              </Link>
              <Link to="/signup" className="hover:text-green-600">
                Signup
              </Link>
            </>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold hover:bg-green-600 transition"
              >
                {initial}
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-lg py-2 z-50">
                  <Link
                    to="/profile"
                    className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowMenu(false)}
                  >
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center text-center px-6 mt-20">
        <h2 className="text-4xl font-bold mb-4 text-green-700">
          Order Smarter, Together
        </h2>
        <p className="text-gray-600 max-w-2xl mb-8">
          Select your hostel, place group orders, and save time – inspired by the
          Blinkit experience.
        </p>

        <Link
          to="/dashboard"
          className="px-6 py-3 rounded-xl bg-green-600 text-white hover:bg-green-700 transition text-lg"
        >
          Go to Dashboard
        </Link>
      </div>

    
      <div className="flex justify-center items-center mt-12">
        <video
          ref={videoRef}
          src="/videos/blinkitHomepage.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-4/5 h-4/5 object-contain cursor-pointer rounded-lg shadow-lg"
          onClick={() => window.open("https://blinkit.com", "_blank")}
        />
      </div>
    </div>
  );
}

