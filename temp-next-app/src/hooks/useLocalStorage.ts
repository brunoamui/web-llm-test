'use client';

import { useState, useCallback, useRef } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      // Parse stored json or if none return initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // If error also return initialValue
      console.log(error);
      return initialValue;
    }
  });
  
  // Use ref to avoid dependency on storedValue which causes re-creation of setValue
  // This breaks the cycle of updates
  const storedValueRef = useRef(storedValue);
  storedValueRef.current = storedValue;

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  // Memoize the setValue function with minimal dependencies to prevent it changing on every render
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValueRef.current) : value;
      
      // Only update state if the value actually changed
      if (JSON.stringify(storedValueRef.current) !== JSON.stringify(valueToStore)) {
        // Save state
        setStoredValue(valueToStore);
        // Save to local storage
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      }
    } catch (error) {
      // A more advanced implementation would handle the error case
      console.log(error);
    }
  // Only depend on key, not on storedValue which changes frequently
  }, [key]);

  return [storedValue, setValue] as const;
}