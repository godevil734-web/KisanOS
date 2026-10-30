import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Check, X } from 'lucide-react';

export interface CropOption {
  id: string;
  name: string;
  nameHi?: string;
  category?: string;
}

export const ALL_INDIAN_CROPS: CropOption[] = [
  { id: 'potato', name: 'Potato', nameHi: 'आलू', category: 'Vegetables' },
  { id: 'wheat', name: 'Wheat', nameHi: 'गेहूं', category: 'Grains' },
  { id: 'tomato', name: 'Tomato', nameHi: 'टमाटर', category: 'Vegetables' },
  { id: 'onion', name: 'Onion', nameHi: 'प्याज', category: 'Vegetables' },
  { id: 'paddy', name: 'Paddy / Rice', nameHi: 'धान / चावल', category: 'Grains' },
  { id: 'mustard', name: 'Mustard', nameHi: 'सरसों', category: 'Oilseeds' },
  { id: 'maize', name: 'Maize', nameHi: 'मक्का', category: 'Grains' },
  { id: 'gram', name: 'Gram (Chana)', nameHi: 'चना', category: 'Pulses' },
  { id: 'soyabean', name: 'Soyabean', nameHi: 'सोयाबीन', category: 'Oilseeds' },
  { id: 'cotton', name: 'Cotton', nameHi: 'कपास', category: 'Fiber' },
  { id: 'sugarcane', name: 'Sugarcane', nameHi: 'गन्ना', category: 'Commercial' },
  { id: 'garlic', name: 'Garlic', nameHi: 'लहसुन', category: 'Spices' },
  { id: 'ginger', name: 'Ginger', nameHi: 'अदरक', category: 'Spices' },
  { id: 'green_chilli', name: 'Green Chilli', nameHi: 'हरी मिर्च', category: 'Spices' },
  { id: 'cauliflower', name: 'Cauliflower', nameHi: 'फूलगोभी', category: 'Vegetables' },
  { id: 'cabbage', name: 'Cabbage', nameHi: 'पत्तागोभी', category: 'Vegetables' },
  { id: 'brinjal', name: 'Brinjal', nameHi: 'बैंगन', category: 'Vegetables' },
  { id: 'bhindi', name: 'Bhindi (Okra)', nameHi: 'भिंडी', category: 'Vegetables' },
  { id: 'kheera', name: 'Cucumber (Kheera)', nameHi: 'खीरा', category: 'Vegetables' },
  { id: 'banana', name: 'Banana', nameHi: 'केला', category: 'Fruits' },
  { id: 'apple', name: 'Apple', nameHi: 'सेब', category: 'Fruits' },
  { id: 'papaya', name: 'Papaya', nameHi: 'पपीता', category: 'Fruits' },
  { id: 'guava', name: 'Guava', nameHi: 'अमरूद', category: 'Fruits' },
  { id: 'bottle_gourd', name: 'Bottle Gourd (Lauki)', nameHi: 'लौकी', category: 'Vegetables' },
  { id: 'bitter_gourd', name: 'Bitter Gourd (Karela)', nameHi: 'करेला', category: 'Vegetables' }
];

interface CropSelectorPortalProps {
  selectedCrop: string;
  onSelect: (cropName: string) => void;
  placeholder?: string;
  themeVariant?: 'harvest' | 'classic';
  customClass?: string;
}

export const CropSelectorPortal: React.FC<CropSelectorPortalProps> = ({
  selectedCrop,
  onSelect,
  placeholder = 'फसल चुनें',
  themeVariant = 'harvest',
  customClass = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [coords, setCoords] = useState<{ top: number; left: number; width: number; maxHeight: number }>({
    top: 0,
    left: 0,
    width: 240,
    maxHeight: 280
  });

  // Filter crops based on search query
  const filteredCrops = useMemo(() => {
    if (!searchQuery.trim()) return ALL_INDIAN_CROPS;
    const q = searchQuery.toLowerCase().trim();
    return ALL_INDIAN_CROPS.filter(
      c => c.name.toLowerCase().includes(q) || (c.nameHi && c.nameHi.includes(q)) || (c.category && c.category.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // Calculate dynamic portal position relative to trigger button
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const width = Math.max(220, Math.min(rect.width * 1.3, 300));
    
    // Horizontal clamping: ensure dropdown stays inside viewport margins
    let left = rect.left;
    if (left + width > viewportWidth - 12) {
      left = Math.max(12, viewportWidth - width - 12);
    }

    // Vertical positioning: decide whether to show below or above trigger
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const desiredHeight = 280;

    let top = rect.bottom + 6;
    let maxHeight = Math.min(desiredHeight, spaceBelow - 12);

    if (spaceBelow < 180 && spaceAbove > spaceBelow) {
      // Show above trigger if space below is limited
      maxHeight = Math.min(desiredHeight, spaceAbove - 12);
      top = rect.top - maxHeight - 6;
    }

    setCoords({
      top: top + window.scrollY,
      left: left + window.scrollX,
      width,
      maxHeight: Math.max(140, maxHeight)
    });
  }, []);

  // Recalculate position whenever opened or window resized/scrolled
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      setHighlightedIndex(0);
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);

      const handleScrollOrResize = () => updatePosition();
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
      };
    }
  }, [isOpen, updatePosition]);

  // Outside click handler
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1 < filteredCrops.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : filteredCrops.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCrops[highlightedIndex]) {
        onSelect(filteredCrops[highlightedIndex].name);
        setIsOpen(false);
        setSearchQuery('');
        triggerRef.current?.focus();
      }
    }
  };

  const isHarvest = themeVariant === 'harvest';

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`w-full sm:w-auto flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          isHarvest
            ? 'bg-[#E8F1E5] hover:bg-[#d8e7d4] text-[#176B45] border border-[#37A86B]/20'
            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
        } ${customClass}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate max-w-[140px]">🌾 {selectedCrop || placeholder}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${
          isHarvest ? 'text-[#176B45]' : 'text-emerald-700'
        }`} />
      </button>

      {/* Portal Dropdown Menu rendered into document.body */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          onKeyDown={handleKeyDown}
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxHeight: `${coords.maxHeight}px`,
            zIndex: 99999
          }}
          className={`rounded-xl bg-white border shadow-2xl flex flex-col overflow-hidden animate-fadeIn ${
            isHarvest ? 'border-[#A3D1A5]' : 'border-emerald-300'
          }`}
          role="listbox"
        >
          {/* Header & Live Search Bar */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <div className="relative flex items-center">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder="फसल खोजें (Search)..."
                className="w-full text-xs font-semibold pl-7 pr-6 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Crops List */}
          <div className="overflow-y-auto flex-1 p-1 divide-y divide-slate-50 overscroll-contain">
            {filteredCrops.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500 font-medium">
                कोई फसल नहीं मिली (No crops found)
              </div>
            ) : (
              filteredCrops.map((crop, idx) => {
                const isSelected = selectedCrop.toLowerCase() === crop.name.toLowerCase();
                const isHighlighted = highlightedIndex === idx;

                return (
                  <div
                    key={crop.id}
                    onClick={() => {
                      onSelect(crop.name);
                      setIsOpen(false);
                      setSearchQuery('');
                      triggerRef.current?.focus();
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    role="option"
                    aria-selected={isSelected}
                    className={`px-2.5 py-2 rounded-lg cursor-pointer text-xs flex items-center justify-between transition-colors ${
                      isHighlighted
                        ? (isHarvest ? 'bg-[#E8F1E5] text-[#104B35] font-black' : 'bg-emerald-50 text-emerald-900 font-black')
                        : 'text-slate-800 font-medium hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold">{crop.name}</span>
                      {crop.nameHi && (
                        <span className="text-[10px] text-slate-500">{crop.nameHi}</span>
                      )}
                    </div>
                    {isSelected && (
                      <Check className={`h-4 w-4 shrink-0 ${isHarvest ? 'text-[#176B45]' : 'text-emerald-600'}`} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
