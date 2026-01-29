import React, { useState, useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
}

interface PlacesFieldProps {
  placeholder?: string;
  defaultValue?: string;
  onPlaceChange: (result: PlaceResult) => void;
  className?: string;
}

/**
 * Reusable Google Places Autocomplete component.
 */
export const PlacesField: React.FC<PlacesFieldProps> = ({ 
  placeholder = "Search area in UAE...", 
  defaultValue = "",
  onPlaceChange, 
  className = "" 
}) => {
  const [placeAutocomplete, setPlaceAutocomplete] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const placesLibrary = useMapsLibrary('places');

  useEffect(() => {
    if (!placesLibrary || !inputRef.current) return;

    const options = {
      fields: ['geometry', 'name', 'formatted_address'],
      componentRestrictions: { country: 'ae' },
      types: ['geocode', 'establishment'] // geocode covers areas, regions, neighborhoods
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
        defaultValue={defaultValue}
        className="w-full bg-transparent border-none p-0 text-[14px] font-normal text-text-dark outline-none focus:ring-0 placeholder-gray-300"
      />
    </div>
  );
};

/**
 * Utility: Get user's current GPS coordinates with 5s timeout
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

/**
 * Utility: Translate coordinates into a Dubai neighborhood name
 */
export const reverseGeocode = (lat: number, lng: number): Promise<string> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.google || !window.google.maps) {
      resolve("Dubai, UAE");
      return;
    }
    
    try {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
        if (status === 'OK' && results && results[0]) {
          const neighborhood = results[0].address_components.find((c: any) => 
            c.types.includes('neighborhood') || c.types.includes('sublocality_level_1')
          );
          if (neighborhood) {
            resolve(`${neighborhood.long_name}, Dubai`);
          } else {
            resolve(results[0].formatted_address.split(',')[0] + ', Dubai');
          }
        } else {
          resolve("Dubai, UAE");
        }
      });
    } catch (e) {
      resolve("Dubai, UAE");
    }
  });
};