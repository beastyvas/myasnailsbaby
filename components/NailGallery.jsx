import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

export default function NailGallery() {
  const [gallery, setGallery] = useState([]);
  const [selectedImg, setSelectedImg] = useState(null);

  // Generate full Supabase Storage public URL
  const fullPublicUrl = (path) =>
    `https://ywpyfrothdaademzkpnl.supabase.co/storage/v1/object/public/gallery/${path}`;

  // Fetch gallery items on load
  useEffect(() => {
    const fetchGallery = async () => {
      const { data, error } = await supabase
        .from("gallery")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load gallery:", error.message);
      } else {
        setGallery(data);
      }
    };

    fetchGallery();
  }, []);

  return (
    <section className="mb-6">
      <h2 className="text-xl font-semibold text-center mt-6 mb-4">
        Nail Gallery ✨
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {gallery.map((item) => (
          <div key={item.id} className="text-center">
            <img
              src={fullPublicUrl(item.image_url)}
              alt={item.caption}
              onClick={() => setSelectedImg(fullPublicUrl(item.image_url))}
              className="w-full rounded-lg shadow-sm hover:shadow-md transition-transform duration-300 hover:scale-105 object-cover cursor-pointer"
            />
            <p className="text-xs text-gray-600 italic mt-1">{item.caption}</p>
          </div>
        ))}
      </div>

      {/* Lightbox preview */}
      {selectedImg && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
          onClick={() => setSelectedImg(null)}
        >
          <img
            src={selectedImg}
            alt="Selected nail design"
            className="max-w-[90%] max-h-[90%] rounded-lg shadow-xl"
          />
        </div>
      )}
    </section>
  );
}
