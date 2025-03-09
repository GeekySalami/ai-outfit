import React, { useEffect, useState } from "react";
import {
  getImages,
  storeFavImages,
  saveFavoriteOutfit,
  removeFavoriteOutfit,
} from "../../utils/indexDB";
import "./Recommendations.scss";
import { getJson } from "../../utils/getJson";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart as farHeart } from "@fortawesome/free-regular-svg-icons";
import { faHeart as fasHeart } from "@fortawesome/free-solid-svg-icons";

const Recommendations = ({ response, style }) => {
  const [favoriteStatus, setFavoriteStatus] = useState({});
  const [error, setError] = useState("");
  const [outfits, setOutfits] = useState([]);
  const navigate = useNavigate();
  const [images, setImages] = useState([]);

  // Parse the response and set outfits
  useEffect(() => {
    try {
      if (response) {
        let parsedOutfits;

        if (typeof response === "string") {
          try {
            parsedOutfits = getJson(response);
          } catch (err) {
            console.error("Error parsing JSON string:", err);
            parsedOutfits = [];
          }
        } else if (Array.isArray(response)) {
          parsedOutfits = response;
        } else {
          console.error("Response is neither a string nor an array:", response);
          parsedOutfits = [];
        }

        if (Array.isArray(parsedOutfits)) {
          setOutfits(parsedOutfits);

          // Initialize favorite status from outfits
          const initialStatus = {};
          parsedOutfits.forEach((outfit) => {
            initialStatus[outfit.outfit_id] = false;
          });
          setFavoriteStatus(initialStatus);
        } else {
          console.error("Processed response is not an array:", parsedOutfits);
          setOutfits([]);
        }
      }
    } catch (err) {
      console.error("Error processing response:", err);
      setOutfits([]);
    }
  }, [response]);

  // Fetch images from IndexedDB
  useEffect(() => {
    const fetchImages = async () => {
      try {
        const storedImages = await getImages();
        setImages(storedImages || []);
      } catch (error) {
        console.error("Error fetching images:", error);
      }
    };
    fetchImages();
  }, []);

  // Toggle favorite status and save/remove outfit in IndexedDB
  const toggleHeart = async (favOutfit) => {
    const currentStatus = favoriteStatus[favOutfit.outfit_id];
    const newStatus = {
      ...favoriteStatus,
      [favOutfit.outfit_id]: !currentStatus,
    };
    setFavoriteStatus(newStatus);

    if (!currentStatus) {
      try {
        const imageFiles = favOutfit.clothes.map((imageID) =>
          getImageFile(imageID)
        );
        console.log("imageFiles", imageFiles);
        await storeFavImages(imageFiles);
        await saveFavoriteOutfit(favOutfit);
        setError("");
      } catch (error) {
        console.error("Failed to save favorite outfit:", error);
        setError("Failed to save favorite outfit");
      }
    } else {
      try {
        console.log("Removing favorite outfit from DB...");
        await removeFavoriteOutfit(favOutfit.outfit_id);
        setError("");
      } catch (error) {
        console.error("Failed to remove favorite outfit:", error);
        setError("Failed to remove favorite outfit, please try again.");
      }
    }
  };

  // Get image source from IndexedDB
  const getImageSrc = (imageId) => {
    const image = images.find((img) => img.id === imageId);
    
    if (!image) {
      console.warn(`Image ID not found: ${imageId}`);
      return "";
    }
  
    if (image.blob instanceof Blob) {
      try {
        return URL.createObjectURL(image.blob);
      } catch (err) {
        console.error("Error creating Object URL from Blob:", err);
        return "";
      }
    } 
    
    if (typeof image.url === "string" && image.url.startsWith("blob:")) {
      return image.url;
    }
  
    console.error(`Invalid image format for ID: ${imageId}`, image);
    return "";
  };
  

  // Get image file from IndexedDB
  const getImageFile = (imageId) => {
    return images.find((img) => img.id === imageId) || null;
  };

  // Cleanup Object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.blob instanceof Blob) {
          URL.revokeObjectURL(URL.createObjectURL(new Blob([img.blob], { type: img.blob.type })));
        }
      });
    };
  }, [images]);

  if (images.length === 0 || !response) {
    return <div className="outfit__loading">Loading...</div>;
  } else if (!outfits || outfits.length === 0) {
    return (
      <div className="recommendations">
        <h1 className="outfit__heading">
          Oops, our AI Advisor just sloped away
        </h1>
        <p className="outfit__error-text">
          {typeof response === "string" ? response : "No outfits found"}
        </p>
        <button className="primary__btn" onClick={() => navigate(-1)}>
          Try Again
        </button>
      </div>
    );
  } else {
    return (
      <div className="recommendations">
        <h1 className="outfit-heading">
          Here are some outfit ideas to look {style?.toLowerCase() || "stylish"}:
        </h1>
        <div className="error">{error.length > 0 && error}</div>
        <div className="outfit-gallery">
          {outfits.map((outfit) => (
            <div key={outfit.outfit_id} className="outfit-card">
              <div className="outfit-card__header">
                <h2 className="outfit-card__text outfit-card__heading">
                  Outfit {outfit.outfit_id}
                </h2>
                <div onClick={() => toggleHeart(outfit)}>
                  <FontAwesomeIcon
                    className="icon"
                    icon={
                      favoriteStatus[outfit.outfit_id] ? fasHeart : farHeart
                    }
                    style={{
                      color: favoriteStatus[outfit.outfit_id] ? "pink" : "#5c667e",
                    }}
                  />
                </div>
              </div>
              <div className="outfit-card__images">
                {outfit.clothes && Array.isArray(outfit.clothes) ? (
                  outfit.clothes.map((id) => (
                    <img
                      className="outfit-card__image"
                      key={id}
                      src={getImageSrc(id)}
                      alt={id}
                    />
                  ))
                ) : (
                  <p>No images available</p>
                )}
              </div>
              <p className="outfit-card__text">Score: {outfit.score}</p>
              <p className="outfit-card__text">{outfit.considerations}</p>
            </div>
          ))}
        </div>
        <button className="primary__btn" onClick={() => navigate(-1)}>
          Try New Looks
        </button>
      </div>
    );
  }
};

export default Recommendations;
