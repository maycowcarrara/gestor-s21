import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Login() {
    const { loginGoogle, user, isPermitted, loading } = useAuth();
    const navigate = useNavigate();

    // EFEITO DE REDIRECIONAMENTO (O segredo está aqui!)
    useEffect(() => {
        if (user && isPermitted) {
            toast.success(`Bem-vindo, ${user.displayName}!`);
            navigate('/'); // Manda para o Dashboard
        }
    }, [user, isPermitted, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center animate-in fade-in zoom-in duration-300">

                <div className="flex justify-center mb-6">
                    <div className="bg-blue-100 p-4 rounded-full">
                        <ShieldCheck size={48} className="text-blue-600" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-gray-800 mb-2">Gestor S-21</h1>
                <p className="text-gray-500 mb-8">Acesso restrito à comissão e secretário.</p>

                {loading ? (
                    <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <button
                        onClick={loginGoogle}
                        className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 px-4 rounded-xl transition shadow-sm group"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                        <span className="group-hover:text-blue-600 transition">Entrar com Google</span>
                    </button>
                )}

                <p className="text-xs text-gray-400 mt-8">
                    Sistema seguro e criptografado. Apenas emails autorizados.
                </p>
            </div>
        </div>
    );
}