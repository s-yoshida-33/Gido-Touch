// src/components/LanguageSelectModal.tsx
import React, { useRef, useEffect, useState } from "react";
import selectLanguageBg from "../assets/select-language-bg.svg";
import selectLanguageJp from "../assets/select-language-jp.svg";
import selectLanguageJpHighlight from "../assets/select-language-jp-highlight.svg";
import selectLanguageEn from "../assets/select-language-en.svg";
import selectLanguageEnHighlight from "../assets/select-language-en-highlight.svg";

interface LanguageSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLElement | null>;
  onLanguageChange?: (language: Language) => void;
}

type Language = "ja" | "en";

const LANGUAGE_STORAGE_KEY = "gido-selected-language";

// Get saved language or default to Japanese
const getSavedLanguage = (): Language => {
  if (typeof window !== "undefined" && window.localStorage) {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === "en" || saved === "ja") {
      return saved;
    }
  }
  return "ja"; // Default to Japanese
};

// Save language preference
const saveLanguage = (language: Language) => {
  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }
};

export const LanguageSelectModal: React.FC<LanguageSelectModalProps> = ({
  isOpen,
  onClose,
  buttonRef,
  onLanguageChange,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(() => getSavedLanguage());
  const [hoveredLanguage, setHoveredLanguage] = useState<Language | null>(null);
  const [pressedLanguage, setPressedLanguage] = useState<Language | null>(null);

  // Load saved language when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedLanguage(getSavedLanguage());
    }
  }, [isOpen]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, buttonRef]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Calculate position relative to button
  const getModalPosition = () => {
    if (!buttonRef.current) {
      return { top: 0, left: 0 };
    }

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const modalWidth = 537; // SVG width
    const modalHeight = 287; // SVG height
    const gap = 3; // Gap between button and modal

    // Position above the button, centered horizontally
    const top = buttonRect.top - modalHeight - gap;
    const left = buttonRect.left + buttonRect.width / 2 - modalWidth / 2;

    return { top, left };
  };

  const position = getModalPosition();

  const handleLanguageSelect = (language: Language) => {
    setSelectedLanguage(language);
    saveLanguage(language);
    // Notify parent component of language change
    if (onLanguageChange) {
      onLanguageChange(language);
    }
    // TODO: Implement language change logic (e.g., update app language)
    console.log("Selected language:", language);
    onClose();
  };

  const handleMouseDown = (language: Language) => {
    setPressedLanguage(language);
  };

  const handleMouseUp = (language: Language) => {
    setPressedLanguage(null);
    handleLanguageSelect(language);
  };

  const handleMouseLeave = () => {
    setHoveredLanguage(null);
    setPressedLanguage(null);
  };

  // Determine which image to show for each language
  const getJapaneseImage = () => {
    if (pressedLanguage === "ja") return selectLanguageJpHighlight;
    if (hoveredLanguage === "ja") return selectLanguageJpHighlight;
    if (selectedLanguage === "ja") return selectLanguageJpHighlight;
    return selectLanguageJp;
  };

  const getEnglishImage = () => {
    if (pressedLanguage === "en") return selectLanguageEnHighlight;
    if (hoveredLanguage === "en") return selectLanguageEnHighlight;
    if (selectedLanguage === "en") return selectLanguageEnHighlight;
    return selectLanguageEn;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999,
          pointerEvents: "auto",
        }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        ref={modalRef}
        style={{
          position: "fixed",
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: "537px",
          height: "287px",
          zIndex: 1000,
          pointerEvents: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background */}
        <img
          src={selectLanguageBg}
          alt="Language Select Background"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
          draggable={false}
        />

        {/* Japanese option (top) - positioned at y=46 based on original design */}
        <div
          onMouseEnter={() => setHoveredLanguage("ja")}
          onMouseLeave={handleMouseLeave}
          onMouseDown={() => handleMouseDown("ja")}
          onMouseUp={() => handleMouseUp("ja")}
          style={{
            position: "absolute",
            top: "46px",
            left: "36px",
            width: "465px",
            height: "66px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={getJapaneseImage()}
            alt="日本語"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              pointerEvents: "none",
            }}
            draggable={false}
          />
        </div>

        {/* English option (bottom) - positioned at y=142 based on original design */}
        <div
          onMouseEnter={() => setHoveredLanguage("en")}
          onMouseLeave={handleMouseLeave}
          onMouseDown={() => handleMouseDown("en")}
          onMouseUp={() => handleMouseUp("en")}
          style={{
            position: "absolute",
            top: "142px",
            left: "36px",
            width: "465px",
            height: "66px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={getEnglishImage()}
            alt="English"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              pointerEvents: "none",
            }}
            draggable={false}
          />
        </div>
      </div>
    </>
  );
};
