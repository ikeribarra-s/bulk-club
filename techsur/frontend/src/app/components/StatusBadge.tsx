import { cn } from "../lib/utils";

type StatusType =
  | 'disponible' | 'reservado' | 'vendido'
  | 'nuevo' | 'usado' | 'reacondicionado'
  | 'efectivo' | 'transferencia' | 'tarjeta' | 'mixto'
  | 'bueno' | 'regular' | 'malo';

const statusStyles: Record<StatusType, string> = {
  disponible: 'bg-green-50 text-green-700 border-green-200',
  reservado: 'bg-amber-50 text-amber-700 border-amber-200',
  vendido: 'bg-gray-100 text-gray-700 border-gray-200',
  nuevo: 'bg-blue-50 text-blue-700 border-blue-200',
  usado: 'bg-amber-50 text-amber-700 border-amber-200',
  reacondicionado: 'bg-purple-50 text-purple-700 border-purple-200',
  efectivo: 'bg-green-50 text-green-700 border-green-200',
  transferencia: 'bg-blue-50 text-blue-700 border-blue-200',
  tarjeta: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  mixto: 'bg-pink-50 text-pink-700 border-pink-200',
  bueno: 'bg-green-50 text-green-700 border-green-200',
  regular: 'bg-amber-50 text-amber-700 border-amber-200',
  malo: 'bg-red-50 text-red-700 border-red-200',
};

const statusLabels: Record<StatusType, string> = {
  disponible: 'Disponible',
  reservado: 'Reservado',
  vendido: 'Vendido',
  nuevo: 'Nuevo',
  usado: 'Usado',
  reacondicionado: 'Reacondicionado',
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  mixto: 'Mixto',
  bueno: 'Bueno',
  regular: 'Regular',
  malo: 'Malo',
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        statusStyles[status],
        className
      )}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}
