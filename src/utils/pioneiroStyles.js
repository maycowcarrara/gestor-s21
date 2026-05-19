export const getPioneiroTipoClassName = (tipo) => {
    switch (tipo) {
        case 'Pioneiro Auxiliar':
            return 'text-blue-600';
        case 'Pioneiro Regular':
            return 'text-yellow-600';
        case 'Pioneiro Especial':
        case 'Missionário':
            return 'text-purple-600';
        default:
            return 'text-gray-400';
    }
};
