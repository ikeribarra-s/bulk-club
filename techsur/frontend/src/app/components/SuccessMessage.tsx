interface Props {
  message: string;
}

export default function SuccessMessage({ message }: Props) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
      <p className="text-sm text-green-700">{message}</p>
    </div>
  );
}
