import React, { useState, useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
}

interface PlacesFieldProps {
  placeholder?: string;
  onPlaceChange: (result: PlaceResult) => void;
  className?: string;
}

/**
 * Reusable Google Places Autocomplete component.
 * Following the exact implementation pattern provided by the user.
 */
export const PlacesField: React.FC<PlacesFieldProps> = ({ 
  placeholder = "Search area in UAE...", 
  onPlaceChange, 
  className = "" 
}) => {
  const [placeAutocomplete, setPlaceAutocomplete] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const placesLibrary = useMapsLibrary('places');

  useEffect(() => {
    if (!placesLibrary || !inputRef.current) return;

    // Pattern from provided snippet
    const options = {
      fields: ['geometry', 'name', 'formatted_address'],
      componentRestrictions: { country: 'ae' } // Still restricting to UAE for the marketplace use case
    };

    const autocomplete = new placesLibrary.Autocomplete(inputRef.current, options);
    setPlaceAutocomplete(autocomplete);

    return () => {
      if (window.google && window.google.maps) {
        window.google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [placesLibrary]);

  useEffect(() => {
    if (!placeAutocomplete) return;

    // Pattern from provided snippet
    const listener = placeAutocomplete.addListener('place_changed', () => {
      const place = placeAutocomplete.getPlace();
      if (place && place.geometry && place.geometry.location) {
        onPlaceChange({
          name: place.formatted_address || place.name || '',
          lat: typeof place.geometry.location.lat === 'function' ? place.geometry.location.lat() : place.geometry.location.lat,
          lng: typeof place.geometry.location.lng === 'function' ? place.geometry.location.lng() : place.geometry.location.lng
        });
      }
    });

    return () => {
      if (window.google && window.google.maps) {
        window.google.maps.event.removeListener(listener);
      }
    };
  }, [onPlaceChange, placeAutocomplete]);

  return (
    <div className={`w-full relative ${className}`}>
      <input 
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        className="w-full bg-transparent border-none p-0 text-[14px] font-bold text-text-dark outline-none focus:ring-0 placeholder-gray-300"
      />
    </div>
  );
};

/**
 * Utility: Get user's current GPS coordinates
 */
export const getCurrentLocation = (): Promise<{lat: number, lng: number}> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });
};