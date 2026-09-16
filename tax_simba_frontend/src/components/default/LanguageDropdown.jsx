// "use client";

// import React from "react";
// import { useState } from 'react';

// const LanguageDropdown = ({ selectedLang, languages, onSelect }) => {
//     // const [text, setText] = useState('');
//     // const [translatedText, setTranslatedText] = useState('');
//     // const [selectedLanguage, setSelectedLanguage] = useState('es');
//     // const [isLoading, setIsLoading] = useState(false);


//     const [translatedText, setTranslatedText] = useState('');
//   const [isLoading, setIsLoading] = useState(false);

//   const handleTranslate = async (textToTranslate, targetLangCode) => {
//     setIsLoading(true);
//     try {
//       const response = await fetch('/api/translate', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           text: textToTranslate,
//           targetLanguage: targetLangCode,
//         }),
//       });

//       const data = await response.json();
      
//       if (response.ok) {
//         setTranslatedText(data.translatedText);
//       }
//     } catch (error) {
//       console.error('Translation error:', error);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return (
//     <ul className="language-options" id="languageOptions" role="listbox">
//       {languages.map(({ code, label }) => (
//         <li
//           key={code}
//           data-lang={code}
//           onClick={() => onSelect({ code, label })}
//           role="option"
//           aria-selected={selectedLang.code === code}
//           tabIndex={0}
//           onKeyDown={(e) => {
//             if (e.key === "Enter" || e.key === " ") {
//               e.preventDefault();
//               onSelect({ code, label });
//             }
//           }}
//         >
//           {label}
//         </li>
//       ))}
//     </ul>
//   );
// };

// export default LanguageDropdown;




"use client";

import React from "react";

const LanguageDropdown = ({ selectedLang, languages, onSelect }) => {
  return (
    <ul className="language-options" id="languageOptions" role="listbox">
      {languages.map(({ code, label }) => (
        <li
          key={code}
          data-lang={code}
          onClick={() => onSelect({ code, label })}
          role="option"
          aria-selected={selectedLang.code === code}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect({ code, label });
            }
          }}
        >
          {label}
        </li>
      ))}
    </ul>
  );
};

export default LanguageDropdown;