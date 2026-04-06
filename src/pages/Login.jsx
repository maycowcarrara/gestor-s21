import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/auth-context';

export default function Login() {
    const { loginGoogle, user, userRole, isPermitted, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [fazendoLogin, setFazendoLogin] = useState(false);
    const jaRecepcionadoRef = useRef(false);

    useEffect(() => {
        if (!user) {
            jaRecepcionadoRef.current = false;
            return;
        }

        if (!authLoading && isPermitted && !jaRecepcionadoRef.current) {
            jaRecepcionadoRef.current = true;
            toast.success(`Bem-vindo, ${userRole === 'admin' ? 'Coordenador/Secretário' : 'Irmão'}!`);
            navigate('/', { replace: true });
        }
    }, [authLoading, isPermitted, navigate, user, userRole]);

    const handleLogin = async () => {
        setFazendoLogin(true);
        try {
            await loginGoogle();
        } finally {
            setFazendoLogin(false);
        }
    };

    const emVerificacao = authLoading || fazendoLogin;

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center animate-in fade-in zoom-in duration-300">
                <div className="flex justify-center mb-6">
                    <div className="bg-blue-100 p-4 rounded-full">
                        {emVerificacao ? (
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        ) : (
                            <ShieldCheck size={48} className="text-blue-600" />
                        )}
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-gray-800 mb-2">Gestor S-21</h1>
                <p className="text-gray-500 mb-8">Acesso restrito à comissão e secretário.</p>

                {emVerificacao ? (
                    <div className="flex flex-col items-center justify-center py-4 gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-gray-400">Verificando credenciais teocráticas...</span>
                    </div>
                ) : (
                    <button
                        onClick={handleLogin}
                        className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 px-4 rounded-xl transition shadow-sm group"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                        <span className="group-hover:text-blue-600 transition">Entrar com Google</span>
                    </button>
                )}

                <p className="text-xs text-gray-400 mt-8 border-t pt-4">
                    Se você é um ancião e não consegue acessar, contate o Secretário para adicionar seu e-mail na lista de permissões.
                </p>
            </div>
        </div>
    );
}
