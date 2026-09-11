// Public, optimized decorative assets only. Originals remain in /Assests.
// Set either image to null to use the gradient; mobile falls back to desktop.
export const background:{desktop:string|null;mobile:string|null;position:string;mobilePosition:string;tint:string;tintStrength:number;fallback:string}={
 desktop:'/backgrounds/vaanisetu-desktop.webp',mobile:'/backgrounds/vaanisetu-mobile.webp',
 position:'50% 50%',mobilePosition:'42% 50%',tint:'#edf6f1',tintStrength:.08,
 fallback:'linear-gradient(135deg,#c7e1d5 0%,#f0f6f3 48%,#8ab8a7 100%)'
};
